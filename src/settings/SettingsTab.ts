import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import { SettingsManager, Neo4jSettings } from './SettingsManager';

/**
 * Settings tab UI for Neo4j plugin configuration
 */
export class Neo4jSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private settingsManager: SettingsManager,
    private settings: Neo4jSettings,
    private onSettingsChange: (settings: Neo4jSettings) => void
  ) {
    super(app, settingsManager['plugin']); // Access the plugin through settingsManager
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();
    containerEl.createEl("h2", { text: "Neo4j Connection Settings" });

    new Setting(containerEl)
      .setName("Bolt URL")
      .setDesc("Neo4j database Bolt protocol URL")
      .addText((text) =>
        text
          .setPlaceholder("bolt://localhost:7687")
          .setValue(this.settings.boltUrl)
          .onChange(async (value) => {
            this.settings.boltUrl = value;
            await this.settingsManager.saveSettings(this.settings);
            this.onSettingsChange(this.settings);
          })
      );

    new Setting(containerEl)
      .setName("Username")
      .setDesc("Neo4j database username")
      .addText((text) =>
        text
          .setPlaceholder("neo4j")
          .setValue(this.settings.username)
          .onChange(async (value) => {
            this.settings.username = value;
            await this.settingsManager.saveSettings(this.settings);
            this.onSettingsChange(this.settings);
          })
      );

    new Setting(containerEl)
      .setName("Password")
      .setDesc("Neo4j database password")
      .addText((text) => {
        text
          .setPlaceholder("Enter password")
          .setValue(this.settings.password)
          .onChange(async (value) => {
            this.settings.password = value;
            await this.settingsManager.saveSettings(this.settings);
            this.onSettingsChange(this.settings);
          });
        text.inputEl.type = "password";
      });

    new Setting(containerEl)
      .setName("Use encryption")
      .setDesc("Enable encrypted connection")
      .addToggle((toggle) =>
        toggle
          .setValue(this.settings.encrypted)
          .onChange(async (value) => {
            this.settings.encrypted = value;
            await this.settingsManager.saveSettings(this.settings);
            this.onSettingsChange(this.settings);
          })
      );

    // Test connection button
    new Setting(containerEl)
      .setName("Test Connection")
      .setDesc("Verify that the connection settings work")
      .addButton((button) =>
        button
          .setButtonText("Test Connection")
          .setCta()
          .onClick(async () => {
            button.setButtonText("Testing...");
            button.setDisabled(true);
            
            try {
              const result = await this.settingsManager.testConnection(this.settings);
              if (result.success) {
                new Notice(`✅ ${result.message}`);
              } else {
                new Notice(`❌ ${result.message}`);
              }
            } finally {
              button.setButtonText("Test Connection");
              button.setDisabled(false);
            }
          })
      );
  }
}