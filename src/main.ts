import {
  App,
  Plugin,
  PluginSettingTab,
  Setting,
  MarkdownPostProcessorContext,
} from "obsidian";

interface Neo4jSettings {
  boltUrl: string;
  username: string;
  password: string;
  encrypted: boolean;
  connectionTimeout: number;
  maxConnectionPoolSize: number;
}

const DEFAULT_SETTINGS: Neo4jSettings = {
  boltUrl: "bolt://localhost:7687",
  username: "neo4j",
  password: "",
  encrypted: false,
  connectionTimeout: 30000,
  maxConnectionPoolSize: 50,
};

export default class Neo4jPlugin extends Plugin {
  settings: Neo4jSettings;

  async onload() {
    await this.loadSettings();

    // Add settings tab
    this.addSettingTab(new Neo4jSettingTab(this.app, this));

    // Register code block processor
    this.registerMarkdownCodeBlockProcessor(
      "neo4j-graph",
      this.processNeo4jCodeBlock.bind(this)
    );

    console.log("Neo4j plugin loaded");
  }

  onunload() {
    console.log("Neo4j plugin unloaded");
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async processNeo4jCodeBlock(
    source: string,
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext
  ) {
    // TODO: Implement query processing
    el.createEl("div", { text: "Neo4j query processor - Coming soon!" });
    el.createEl("pre", { text: source });
  }
}

class Neo4jSettingTab extends PluginSettingTab {
  plugin: Neo4jPlugin;

  constructor(app: App, plugin: Neo4jPlugin) {
    super(app, plugin);
    this.plugin = plugin;
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
          .setValue(this.plugin.settings.boltUrl)
          .onChange(async (value) => {
            this.plugin.settings.boltUrl = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Username")
      .setDesc("Neo4j database username")
      .addText((text) =>
        text
          .setPlaceholder("neo4j")
          .setValue(this.plugin.settings.username)
          .onChange(async (value) => {
            this.plugin.settings.username = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Password")
      .setDesc("Neo4j database password")
      .addText((text) =>
        text
          .setPlaceholder("Enter password")
          .setValue(this.plugin.settings.password)
          .onChange(async (value) => {
            this.plugin.settings.password = value;
            await this.plugin.saveSettings();
          })
          .inputEl.type = "password"
      );

    new Setting(containerEl)
      .setName("Use encryption")
      .setDesc("Enable encrypted connection")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.encrypted)
          .onChange(async (value) => {
            this.plugin.settings.encrypted = value;
            await this.plugin.saveSettings();
          })
      );
  }
}