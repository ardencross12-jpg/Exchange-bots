const {
  Client,
  GatewayIntentBits,
  SlashCommandBuilder,
  REST,
  Routes,
  PermissionFlagsBits
} = require("discord.js");

const express = require("express");
const fs = require("fs");

/* ================= WEB SERVER (RENDER) ================= */

const app = express();
app.get("/", (req, res) => res.send("Bot is running"));
app.listen(3000, () => console.log("Web server running"));

/* ================= ENV VARIABLES ================= */

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

/* ================= LOAD CONFIG ================= */

let config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
let RATE = config.rate;

/* ================= DISCORD CLIENT ================= */

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

/* ================= SLASH COMMANDS ================= */

const commands = [

  new SlashCommandBuilder()
    .setName("c2i")
    .setDescription("Convert USDT to INR")
    .addNumberOption(option =>
      option.setName("amount").setDescription("USDT amount").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("i2c")
    .setDescription("Convert INR to USDT")
    .addNumberOption(option =>
      option.setName("amount").setDescription("INR amount").setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("setrate")
    .setDescription("Set USDT rate (ADMIN)")
    .addNumberOption(option =>
      option.setName("rate").setDescription("New rate").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("setlogs")
    .setDescription("Set logs channel (ADMIN)")
    .addChannelOption(option =>
      option.setName("channel").setDescription("Logs channel").setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Check exchange statistics")
    .addUserOption(option =>
      option.setName("user").setDescription("Check specific user").setRequired(false)
    )

].map(cmd => cmd.toJSON());

/* ================= REGISTER COMMANDS ================= */

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("Slash commands registered");
  } catch (error) {
    console.error(error);
  }
})();

/* ================= INTERACTION HANDLER ================= */

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const amount = interaction.options.getNumber("amount");

  if (interaction.commandName === "c2i") {
    const result = amount * RATE;

    updateStats(interaction.user.id, amount, result);

    await interaction.reply(💱 ${amount} USDT = ₹${result.toFixed(2)} INR);
    logAction(interaction, ${amount} USDT → ₹${result.toFixed(2)});
  }

  if (interaction.commandName === "i2c") {
    const result = amount / RATE;

    updateStats(interaction.user.id, result, amount);

    await interaction.reply(💱 ₹${amount} INR = ${result.toFixed(4)} USDT);
    logAction(interaction, ₹${amount} → ${result.toFixed(4)} USDT);
  }

  if (interaction.commandName === "setrate") {
    RATE = interaction.options.getNumber("rate");
    config.rate = RATE;
    saveConfig();
    await interaction.reply(✅ Rate updated: 1 USDT = ₹${RATE});
  }

  if (interaction.commandName === "setlogs") {
    const channel = interaction.options.getChannel("channel");
    config.logChannelId = channel.id;
    saveConfig();
    await interaction.reply("✅ Logs channel set");
  }

  if (interaction.commandName === "stats") {
    const target = interaction.options.getUser("user") || interaction.user;
    const userStats = config.users[target.id] || { usdt: 0, inr: 0 };

    await interaction.reply(
`📊 Exchange Stats

User: ${target.tag}
USDT: ${userStats.usdt.toFixed(4)}
INR: ₹${userStats.inr.toFixed(2)}

🌍 Global Totals
USDT: ${config.totals.usdt.toFixed(4)}
INR: ₹${config.totals.inr.toFixed(2)}
    );
  }
});

/* ================= FUNCTIONS ================= */

function updateStats(userId, usdtAmount, inrAmount) {
  config.totals.usdt += usdtAmount;
  config.totals.inr += inrAmount;

  if (!config.users[userId]) {
    config.users[userId] = { usdt: 0, inr: 0 };
  }

  config.users[userId].usdt += usdtAmount;
  config.users[userId].inr += inrAmount;

  saveConfig();
}

function saveConfig() {
  fs.writeFileSync("./config.json", JSON.stringify(config, null, 2));
}

function logAction(interaction, text) {
  if (!config.logChannelId) return;

  const channel = interaction.guild.channels.cache.get(config.logChannelId);
  if (!channel) return;

  channel.send(📊 ${interaction.user.tag} | ${text});
}

/* ================= READY ================= */

client.once("ready", () => {
  console.log(Bot logged in as ${client.user.tag}`);
});

client.login(TOKEN);
