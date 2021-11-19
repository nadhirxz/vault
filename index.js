#!/usr/bin/env node
const { program, Argument, Option } = require('commander');
const os = require('os');
const path = require('path');
const { hash } = require('./utils/encryption');
const { load, save, changePath, changePassword, vaultFile, clearVault, exists, master, checkFile, exportFile } = require('./utils/files');
const prompt = require('prompt-sync')({ sigint: true });

const actionChoices = ['add', 'remove', 'view', 'config', 'list', 'path', 'clear'];
const configChoices = ['path', 'password'];

program
	.version('1.0.0')
	.description('Simple cli tool to save your secret stuff')
	.addArgument(new Argument('<action>', 'action you want to perform').choices(actionChoices))
	.argument('[name]', 'entry name')
	.argument('[config]', 'config arguments')
	.addOption(new Option('-t, --type <type>').choices(['text', 'account']).default('text'))
	.option('-f, --file <filename>', 'used with add to insert a file')
	.option('-o, --output <filename>', 'output entry instead of console log')
	.action((action, name, config) => {
		if (action == 'config' && !configChoices.includes(name))
			return console.log(
				`invalid config option (choices: ${configChoices
					.map(e => `"${e}"`)
					.join(', ')
					.trim()})`
			);
		runAction(action, name, config);
	})
	.parse();

function runAction(action, name, config) {
	let password = '';
	if (exists) password = prompt('password: ', { echo: '*' });

	if (!exists || hash(password) == master) {
		run(action, name, program.opts().type, config);
	} else {
		console.log('wrong password');
		runAction(action, name, config);
	}
}

function run(action, name, type = 'text', config) {
	load().then(data => {
		switch (action) {
			case 'add': {
				const file = program.opts().file;
				if (!name) return console.log("argument 'name' is required");
				if (data.hasOwnProperty(name)) return console.log('entry already exists');
				if (file) {
					const check = checkFile(file);
					if (!check.valid) return console.log(`${file} doesn't exist`);
					data[name] = { filename: file, buffer: check.file };
				} else if (type == 'account') {
					const username = prompt('username/email: ');
					const password = prompt('password: ', { echo: '*' });
					data[name] = { username, password };
				} else {
					const text = prompt('your text: ');
					data[name] = text;
				}
				save(data);
				console.log('entry added successfully');
				break;
			}

			case 'remove': {
				if (!name) return console.log("argument 'name' is required");
				if (data[name] == undefined) return console.log("entry doesn't exist");
				let confirm = '';
				while (!['y', 'n'].includes(confirm.toLowerCase())) {
					confirm = prompt(`are you sure you want to remove "${name}" ? (Y/N): `);
				}
				if (confirm.toLowerCase() == 'y') {
					delete data[name];
					save(data);
					console.log('entry removed successfully');
				}
				break;
			}

			case 'view': {
				if (!name) return console.log("argument 'name' is required");
				if (data[name] == undefined) return console.log("entry doesn't exist");

				const output = program.opts().output;

				if (typeof data[name] == 'object') {
					if (data[name].filename != undefined) {
						const buffer = Buffer.from(data[name].buffer.data);

						if (output) return exportFile(output, buffer);

						if (require('utf-8-validate')(buffer)) return console.log(buffer.toString());

						let confirm = '';
						while (!['y', 'n'].includes(confirm.toLowerCase())) {
							confirm = prompt('this entry is a file. would you like to export it ? (Y/N): ');
						}

						if (confirm.toLowerCase() == 'y') {
							exportFile(data[name].filename, buffer);
						}
					} else {
						const out = `username/email: ${data[name].username}
						password: ${data[name].password}`;

						if (output) return exportFile(output, Buffer.from(out, 'utf-8'));
						console.log(out);
					}
				} else {
					if (output) return exportFile(output, Buffer.from(data[name], 'utf-8'));
					console.log(data[name]);
				}
				break;
			}

			case 'config': {
				if (!name) return console.log("argument 'name' is required");
				switch (name) {
					case 'path':
						let providedPath = config;
						if (!providedPath) return console.log('please provide a path');
						const absolute = /[a-zA-Z]:\\(((?![<>:"/\\|?*]).)+((?<![ .])\\)?)*/.test(providedPath);
						if (!absolute) {
							const validPath = /^(?!.*[\\\/]\s+)(?!(?:.*\s|.*\.|\W+)$)(?:[a-zA-Z]:)?(?:(?:[^<>:"\|\?\*\n])+(?:\/\/|\/|\\\\|\\)?)+$/.test(providedPath);
							if (!validPath) return console.lod('invalid path');
							providedPath = path.join(process.cwd(), providedPath);
						}
						changePath(providedPath);
						break;
					case 'password':
						changePassword(prompt('new password: '));
						console.log('password changed');
						break;
				}
				break;
			}

			case 'list': {
				const keys = Object.keys(data);
				if (keys.length) return console.log(keys.map(e => ` - ${e}`).join(os.EOL));
				console.log('vault is empty');
				break;
			}

			case 'path': {
				console.log('current path:', vaultFile);
				break;
			}

			case 'clear': {
				let confirm = '';
				while (!['y', 'n'].includes(confirm.toLowerCase())) {
					confirm = prompt(`are you sure you want to clear the vault ? (Y/N): `);
				}
				if (confirm.toLowerCase() == 'y') {
					clearVault();
					console.log('vault cleared successfully');
				}
				break;
			}
		}
	});
}
