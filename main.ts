import {
	App,
	Command,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFolder,
	TFile,
} from "obsidian";

import * as crypto from "crypto";

// Remember to rename these classes and interfaces!

interface MoveFileConfig {
	sourceFolderPath: string;
	commandName: string;
	commandId: string;
}

interface MoveFilePluginSettings {
	moveFileConfigs: MoveFileConfig[];
}

const DEFAULT_SETTINGS: MoveFilePluginSettings = {
	moveFileConfigs: [],
};

export default class MoveFilePlugin extends Plugin {
	settings: MoveFilePluginSettings;

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new MoveFileSettingTab(this.app, this));
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async addCustomCommand(
		moveFileConfig: MoveFileConfig,
		index: number
	): Promise<Command> {
		return this.addCommand({
			id: this.generate16CharHash(moveFileConfig.commandName + index),
			name: moveFileConfig.commandName,
			checkCallback: (checking: boolean) => {
				const targetFolderPath = moveFileConfig.sourceFolderPath;
				const activeFile = this.app.workspace.getActiveFile();
				if (activeFile) {
					if (!checking) {
						this.moveFile(activeFile, targetFolderPath);
					}
					return true;
				}
				return false;
			},
		});
	}

	async moveFile(file: TFile, targetFolderPath: string) {
		const targetFolder =
			this.app.vault.getAbstractFileByPath(targetFolderPath);

		// Check if the target folder exists
		if (!targetFolder || !(targetFolder instanceof TFolder)) {
			new Notice(`Target folder "${targetFolderPath}" not found.`);
			return;
		}

		// Check if the file is already in the target folder
		if (!file.parent || file.parent.path === targetFolderPath) {
			new Notice(`File is already in "${targetFolderPath}"`);
			return;
		}

		const newPath = `${targetFolderPath}/${file.name}`;
		try {
			await this.app.vault.rename(file, newPath);
			new Notice(`Moved "${file.name}" to "${targetFolderPath}"`);
		} catch (error) {
			new Notice(`Error moving file: ${error}`);
			console.error("Error moving file:", error);
		}
	}

	generate16CharHash(inputString: string): string {
		const hash = crypto.createHash("sha256"); // You can use other algorithms like 'md5', but SHA-256 is generally recommended
		hash.update(inputString);
		const fullHash = hash.digest("hex");
		return fullHash.substring(0, 16); // Truncate to 16 characters
	}
}

class MoveFileSettingTab extends PluginSettingTab {
	plugin: MoveFilePlugin;
	app: App;

	constructor(app: App, plugin: MoveFilePlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.app = app;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName("Add a configuration")
			.setDesc(
				"Create a command to quickly move files to a particular folder"
			)
			.addButton((button) => {
				button
					.setClass("add-config-btn")
					.setButtonText("Add Config")
					.onClick(async () => {
						this.plugin.settings.moveFileConfigs.push({
							commandName: "",
							sourceFolderPath: "",
							commandId: "",
						});
						this.display();
						new Notice(`Added Quick Move Configuration`);
					});
			});

		this.plugin.settings.moveFileConfigs.forEach(
			(moveFileConfig, index) => {
				// containerEl.createEl("h2", {
				// 	text: `Configuration ${index + 1}`,
				// });

				new Setting(containerEl).setName('Configuration ' + (index + 1)).setHeading();

				new Setting(containerEl)
					.setName("Name")
					.setDesc("Name of the command to add. Eg: Mark as completed")
					.addText((text) =>
						text
							.setPlaceholder("Command name")
							.setValue(moveFileConfig.commandName)
							.onChange(async (value) => {
								moveFileConfig.commandName = value;
							})
					);

				new Setting(containerEl)
					.setName("Path")
					.setDesc("Relative path to the destination folder")
					.addText((text) =>
						text
							.setPlaceholder("Path to Folder")
							.setValue(moveFileConfig.sourceFolderPath)
							.onChange(async (value) => {
								moveFileConfig.sourceFolderPath = value;
							})
					);

				const setting = new Setting(containerEl).addButton((button) => {
					button
						.setButtonText("Save")
						.onClick(async () => {
							
							// Remove configuraiton if exists
							if (moveFileConfig.commandId) {
								this.plugin.removeCommand(moveFileConfig.commandId);
							}

							if (moveFileConfig.commandName === "") {
								new Notice(`Invalid configuration! Please specify a name for your custom command.`);
								return;
							}

							if (!this.isValidObsidianPath(this.app, moveFileConfig.sourceFolderPath)) {
								new Notice(
									`Path ${moveFileConfig.sourceFolderPath} is invalid! Please enter a valid path.`
								);
								return;
							}

							const command = await this.plugin.addCustomCommand(
								moveFileConfig,
								index
							);

							// We need to extract the command ID from the full command ID
							moveFileConfig.commandId = command.id.split(":")[1];
							console.log(
								`Adding command with ID: ${command.id}`
							);
							await this.plugin.saveSettings();
							new Notice(
								`Saved "${moveFileConfig.commandName}" configuration`
							);
						});
				});

				setting.addButton((cb) => {
					cb.setButtonText("Delete")
						.setClass("delete-btn")
						.onClick(() => {
							this.plugin.settings.moveFileConfigs.splice(
								index,
								1
							);
							console.log(
								`Removing command with ID: ${moveFileConfig.commandId}`
							);
							this.plugin.removeCommand(moveFileConfig.commandId);
							this.plugin.saveSettings();
							this.display();
						});
				});

				// Add existing commands to Obsidian
				if (moveFileConfig.commandId) {
					this.plugin.addCustomCommand(moveFileConfig, index);
				}
			}
		);
	}

	isValidObsidianPath(app: App, path: string): boolean {
		// Check if the path is a string.
		if (typeof path !== "string") {
			return false;
		}

		// Check if a folder exists at the given path.
		const file = app.vault.getAbstractFileByPath(path);
		if (file instanceof TFolder) {
			return true;
		}


		return false;
	}
}
