import {
	App,
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

	async addCustomCommand(moveFileConfig: MoveFileConfig, index: number) {
		const command = this.addCommand({
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
		moveFileConfig.commandId = command.id;
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

	constructor(app: App, plugin: MoveFilePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h3", {
			text: `Quick Move Configuration Settings`,
		});

		new Setting(containerEl)
			.setName("Add a new quick move configuration")
			.addButton((button) => {
				button.setButtonText("Add Config").onClick(async () => {
					this.plugin.settings.moveFileConfigs.push({
						commandName: "",
						sourceFolderPath: "",
						commandId: "",
					});
					await this.plugin.saveSettings();
					this.display();
					new Notice(`Added Quick Move`);
				});
			});

		this.plugin.settings.moveFileConfigs.forEach(
			(moveFileConfig, index) => {
				containerEl.createEl("h2", {
					text: `Configuration ${index + 1}`,
				});

				new Setting(containerEl)
					.setName("Name")
					.setDesc("Example: Mark as completed")
					.addText((text) =>
						text
							.setPlaceholder("Cmmand name")
							.setValue(moveFileConfig.commandName)
							.onChange(async (value) => {
								moveFileConfig.commandName = value;
							})
					);

				new Setting(containerEl)
					.setName("Path")
					.setDesc("Example: /path/to/completed")
					.addText((text) =>
						text
							.setPlaceholder(
								"Enter path to your completed folder"
							)
							.setValue(moveFileConfig.sourceFolderPath)
							.onChange(async (value) => {
								moveFileConfig.sourceFolderPath = value;
							})
					);

				new Setting(containerEl).addExtraButton;

				const setting = new Setting(containerEl).addButton((button) => {
					button
						.setClass("save-btn")
						.setButtonText("Save")
						.onClick(async () => {
							await this.plugin.addCustomCommand(
								moveFileConfig,
								index
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
							this.plugin.removeCommand(moveFileConfig.commandId);
							this.plugin.saveSettings();
							this.display();
						});
				});

				// Add the commands to the plugin
				this.plugin.addCustomCommand(moveFileConfig, index);
			}
		);
	}
}
