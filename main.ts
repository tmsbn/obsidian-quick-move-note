import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFolder,
	TFile,
} from "obsidian";

// Remember to rename these classes and interfaces!

interface MoveFileConfig {
	sourceFolderPath: string;
}

interface MoveFilePluginSettings {
	moveFileConfig: MoveFileConfig;
}

const DEFAULT_SETTINGS: MoveFilePluginSettings = {
	moveFileConfig: {
		sourceFolderPath: "",
	},
};

export default class MoveFilePlugin extends Plugin {
	settings: MoveFilePluginSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: "Move-File-to-Specific-Folder-Command",
			name: "Move file to Completed folder",
			checkCallback: (checking: boolean) => {
				const targetFolderPath =
					this.settings.moveFileConfig.sourceFolderPath;
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

		new Setting(containerEl)
			.setName("Move File Settings")
			.setDesc("Path to your completed folder")
			.addText((text) =>
				text
					.setPlaceholder("Enter path to your completed folder")
					.setValue(
						this.plugin.settings.moveFileConfig.sourceFolderPath
					)
					.onChange(async (value) => {
						this.plugin.settings.moveFileConfig.sourceFolderPath =
							value;
						await this.plugin.saveSettings();
					})
			);
	}
}
