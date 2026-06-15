require("dotenv").config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  AuditLogEvent
} = require("discord.js");

const ms = require("ms");

// ============================================================
// CONFIG — /setup command se change hoga, ya yahan hardcode karo
// ============================================================

const config = {
  logsChannel: process.env.LOGS_CHANNEL || "LOG_CHANNEL_ID",
  verifyChannel: process.env.VERIFY_CHANNEL || "VERIFY_CHANNEL_ID",
  verifiedRole: process.env.VERIFIED_ROLE || "VERIFIED_ROLE_ID",
  ownerId: process.env.OWNER_ID || "YOUR_OWNER_ID",
  secondOwnerId: process.env.SECOND_OWNER_ID || "SECOND_OWNER_ID",

  banWords: ["badword1", "badword2"],
  censorWords: ["censorword1"],
  whitelistWords: [],

  antinuke: {
    enabled: true,
    banThreshold: 3,
    kickThreshold: 3,
    channelDeleteThreshold: 2,
    channelCreateThreshold: 5,
    roleDeleteThreshold: 2,
    webhookThreshold: 2,
    timeWindow: 10000,
    action: "ban",
    whitelist: new Set()
  },

  antibot: {
    enabled: true,
    action: "kick",
    whitelist: new Set()
  },

  antispam: {
    enabled: true,
    messageThreshold: 6,
    timeWindow: 4000,
    dupThreshold: 4,
    capsPercent: 70,
    capsMinLength: 10,
    emojiThreshold: 6,
    inviteLinks: true,
    timeout: "2m"
  },

  antimage: {
    enabled: false
  },

  antiping: {
    enabled: true,
    threshold: 3,
    blockEveryone: true,
    timeout: "1m"
  }
};

// ============================================================
// RUNTIME STORES
// ============================================================

const afkUsers    = new Map();
const spamMap     = new Map();
const dupMap      = new Map();
const nukeTracker = new Map();

// ============================================================
// SLASH COMMANDS
// ============================================================

const commands = [

  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Ban a member from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName("user").setDescription("User to ban").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kick a member from the server")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName("user").setDescription("User to kick").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)),

  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Timeout a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName("user").setDescription("User to timeout").setRequired(true))
    .addStringOption(o => o.setName("time").setDescription("Duration e.g. 10m 1h 30s").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(false)),

  new SlashCommandBuilder()
    .setName("untimeout")
    .setDescription("Remove timeout from a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unban a user by ID")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(o => o.setName("userid").setDescription("User ID to unban").setRequired(true)),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName("user").setDescription("User to warn").setRequired(true))
    .addStringOption(o => o.setName("reason").setDescription("Reason").setRequired(true)),

  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete multiple messages")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(o => o.setName("amount").setDescription("How many messages (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)),

  new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("View info about a user")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(false)),

  new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("View server information"),

  new SlashCommandBuilder()
    .setName("botinfo")
    .setDescription("View bot information"),

  new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Set your AFK status")
    .addStringOption(o => o.setName("reason").setDescription("AFK reason").setRequired(false)),

  new SlashCommandBuilder()
    .setName("say")
    .setDescription("Make the bot send a message")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption(o => o.setName("text").setDescription("Text to send").setRequired(true)),

  new SlashCommandBuilder()
    .setName("announcement")
    .setDescription("Send an announcement embed")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName("text").setDescription("Announcement text").setRequired(true)),

  new SlashCommandBuilder()
    .setName("dm")
    .setDescription("DM a user")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o => o.setName("user").setDescription("User to DM").setRequired(true))
    .addStringOption(o => o.setName("text").setDescription("Message").setRequired(true)),

  new SlashCommandBuilder()
    .setName("dmall")
    .setDescription("DM all members — Owner only")
    .addStringOption(o => o.setName("text").setDescription("Message").setRequired(true)),

  new SlashCommandBuilder()
    .setName("security")
    .setDescription("Check the status of all security modules"),

  new SlashCommandBuilder()
    .setName("antinuke")
    .setDescription("Manage Anti-Nuke whitelist")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s =>
      s.setName("whitelist")
        .setDescription("Add, remove or list whitelisted users")
        .addStringOption(o => o.setName("action").setDescription("add / remove / list").setRequired(true).addChoices(
          { name: "add", value: "add" },
          { name: "remove", value: "remove" },
          { name: "list", value: "list" }
        ))
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(false))
    ),

  new SlashCommandBuilder()
    .setName("antibot")
    .setDescription("Manage Anti-Bot whitelist")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(s =>
      s.setName("whitelist")
        .setDescription("Add, remove or list whitelisted bots")
        .addStringOption(o => o.setName("action").setDescription("add / remove / list").setRequired(true).addChoices(
          { name: "add", value: "add" },
          { name: "remove", value: "remove" },
          { name: "list", value: "list" }
        ))
        .addUserOption(o => o.setName("bot").setDescription("Bot user").setRequired(false))
    ),

  new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure the bot — opens a popup to enter all channel/role IDs")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  new SlashCommandBuilder()
    .setName("togglemodule")
    .setDescription("Enable or disable a security module")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o =>
      o.setName("module").setDescription("Module name").setRequired(true).addChoices(
        { name: "antinuke", value: "antinuke" },
        { name: "antibot", value: "antibot" },
        { name: "antispam", value: "antispam" },
        { name: "antiping", value: "antiping" },
        { name: "antimage", value: "antimage" }
      )
    )
    .addStringOption(o =>
      o.setName("state").setDescription("on or off").setRequired(true).addChoices(
        { name: "on", value: "on" },
        { name: "off", value: "off" }
      )
    ),

].map(cmd => cmd.toJSON());

// ============================================================
// REGISTER COMMANDS
// ============================================================

async function registerCommands() {
  const rest = new REST().setToken(process.env.DISCORD_TOKEN);
  try {
    console.log("[Commands] Registering slash commands...");
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands });
    console.log("[Commands] ✅ All slash commands registered!");
  } catch (err) {
    console.error("[Commands] ❌ Failed to register:", err.message);
  }
}

// ============================================================
// CLIENT
// ============================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildWebhooks,
    GatewayIntentBits.DirectMessages
  ],
  partials: [Partials.Channel]
});

// ============================================================
// HELPERS
// ============================================================

function sendLog(guild, embed) {
  const ch = guild.channels.cache.get(config.logsChannel);
  if (ch) ch.send({ embeds: [embed] }).catch(() => {});
}

function isOwner(userId) {
  return userId === config.ownerId || userId === config.secondOwnerId;
}

function getNukeData(userId) {
  if (!nukeTracker.has(userId)) {
    nukeTracker.set(userId, {
      bans: [], kicks: [], channelDeletes: [],
      channelCreates: [], roleDeletes: [], webhooks: []
    });
  }
  return nukeTracker.get(userId);
}

function countRecent(arr, window) {
  const now = Date.now();
  const recent = arr.filter(t => now - t < window);
  arr.length = 0;
  arr.push(...recent);
  return recent.length;
}

async function nukeAction(guild, userId, reason) {
  if (config.antinuke.whitelist.has(userId) || isOwner(userId)) return;
  const member = guild.members.cache.get(userId);
  if (!member) return;
  try {
    if (config.antinuke.action === "ban") {
      await guild.members.ban(userId, { reason: `[Anti-Nuke] ${reason}` });
    } else {
      await member.roles.set([], `[Anti-Nuke] ${reason}`);
    }
    sendLog(guild, new EmbedBuilder()
      .setTitle("🛡️ Anti-Nuke Triggered")
      .setDescription(`**User:** <@${userId}>\n**Reason:** ${reason}\n**Action:** ${config.antinuke.action.toUpperCase()}`)
      .setColor("DarkRed").setTimestamp()
    );
  } catch (e) {
    console.error("[Anti-Nuke] Action failed:", e.message);
  }
}

// ============================================================
// READY
// ============================================================

client.once("ready", async () => {
  console.log(`[Bot] ✅ ${client.user.tag} is online!`);
  await registerCommands();
});

// ============================================================
// ANTI-BOT + ALT DETECTION + VERIFICATION
// ============================================================

client.on("guildMemberAdd", async member => {
  if (member.user.bot && config.antibot.enabled) {
    if (!config.antibot.whitelist.has(member.user.id)) {
      try {
        if (config.antibot.action === "ban") {
          await member.ban({ reason: "[Anti-Bot] Unauthorized bot joined" });
        } else {
          await member.kick("[Anti-Bot] Unauthorized bot joined");
        }
        sendLog(member.guild, new EmbedBuilder()
          .setTitle("🤖 Anti-Bot — Unauthorized Bot Removed")
          .setDescription(`**Bot:** ${member.user.tag} (\`${member.user.id}\`)\n**Action:** ${config.antibot.action.toUpperCase()}`)
          .setColor("DarkRed").setTimestamp()
        );
      } catch (e) {
        console.error("[Anti-Bot] Failed:", e.message);
      }
      return;
    }
  }

  const days = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
  if (days < 7 && !member.user.bot) {
    sendLog(member.guild, new EmbedBuilder()
      .setTitle("⚠️ Possible Alt Account Detected")
      .setDescription(`**User:** ${member} (${member.user.tag})\n**Account Age:** ${days} day(s)`)
      .setColor("Orange").setTimestamp()
    );
  }

  const verifyChannel = member.guild.channels.cache.get(config.verifyChannel);
  if (verifyChannel && !member.user.bot) {
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("verify").setLabel("✅ Verify").setStyle(ButtonStyle.Success)
    );
    await verifyChannel.send({
      content: `${member}`,
      embeds: [new EmbedBuilder()
        .setTitle("🔐 Verification Required")
        .setDescription("Click the button below to verify yourself and gain access.")
        .setColor("Green")],
      components: [row]
    }).catch(() => {});
  }
});

// ============================================================
// ANTI-NUKE — Audit Log Events
// ============================================================

client.on("guildBanAdd", async ban => {
  await new Promise(r => setTimeout(r, 500));
  const logs = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).catch(() => null);
  if (!logs) return;
  const entry = logs.entries.first();
  if (!entry) return;
  const data = getNukeData(entry.executorId);
  data.bans.push(Date.now());
  if (countRecent(data.bans, config.antinuke.timeWindow) >= config.antinuke.banThreshold) {
    await nukeAction(ban.guild, entry.executorId, `Mass Ban`);
  }
});

client.on("guildMemberRemove", async member => {
  await new Promise(r => setTimeout(r, 500));
  const logs = await member.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberKick }).catch(() => null);
  if (!logs) return;
  const entry = logs.entries.first();
  if (!entry || Date.now() - entry.createdTimestamp > 3000) return;
  const data = getNukeData(entry.executorId);
  data.kicks.push(Date.now());
  if (countRecent(data.kicks, config.antinuke.timeWindow) >= config.antinuke.kickThreshold) {
    await nukeAction(member.guild, entry.executorId, `Mass Kick`);
  }
});

client.on("channelDelete", async channel => {
  if (!channel.guild) return;
  await new Promise(r => setTimeout(r, 500));
  const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).catch(() => null);
  if (!logs) return;
  const entry = logs.entries.first();
  if (!entry) return;
  const data = getNukeData(entry.executorId);
  data.channelDeletes.push(Date.now());
  if (countRecent(data.channelDeletes, config.antinuke.timeWindow) >= config.antinuke.channelDeleteThreshold) {
    await nukeAction(channel.guild, entry.executorId, `Mass Channel Delete`);
  }
});

client.on("channelCreate", async channel => {
  if (!channel.guild) return;
  await new Promise(r => setTimeout(r, 500));
  const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelCreate }).catch(() => null);
  if (!logs) return;
  const entry = logs.entries.first();
  if (!entry) return;
  const data = getNukeData(entry.executorId);
  data.channelCreates.push(Date.now());
  if (countRecent(data.channelCreates, config.antinuke.timeWindow) >= config.antinuke.channelCreateThreshold) {
    await nukeAction(channel.guild, entry.executorId, `Mass Channel Create`);
  }
});

client.on("roleDelete", async role => {
  await new Promise(r => setTimeout(r, 500));
  const logs = await role.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).catch(() => null);
  if (!logs) return;
  const entry = logs.entries.first();
  if (!entry) return;
  const data = getNukeData(entry.executorId);
  data.roleDeletes.push(Date.now());
  if (countRecent(data.roleDeletes, config.antinuke.timeWindow) >= config.antinuke.roleDeleteThreshold) {
    await nukeAction(role.guild, entry.executorId, `Mass Role Delete`);
  }
});

client.on("webhookUpdate", async channel => {
  if (!channel.guild) return;
  await new Promise(r => setTimeout(r, 500));
  const logs = await channel.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.WebhookCreate }).catch(() => null);
  if (!logs) return;
  const entry = logs.entries.first();
  if (!entry || Date.now() - entry.createdTimestamp > 3000) return;
  const data = getNukeData(entry.executorId);
  data.webhooks.push(Date.now());
  if (countRecent(data.webhooks, config.antinuke.timeWindow) >= config.antinuke.webhookThreshold) {
    await nukeAction(channel.guild, entry.executorId, `Mass Webhook Create`);
  }
});

// ============================================================
// MESSAGE AUTOMOD
// ============================================================

const INVITE_REGEX = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9]+/i;
const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const msg = message.content;
  const msgLower = msg.toLowerCase();

  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    await message.reply("✅ Welcome back! Your AFK has been removed.").catch(() => {});
  }

  for (const [, user] of message.mentions.users) {
    if (afkUsers.has(user.id)) {
      const data = afkUsers.get(user.id);
      await message.reply(`💤 **${user.tag}** is currently AFK: ${data.reason}`).catch(() => {});
    }
  }

  const foundBanWord = config.banWords.find(w => msgLower.includes(w));
  const foundCensor  = config.censorWords.find(w => msgLower.includes(w));
  const foundWord = foundBanWord || foundCensor;

  if (foundWord && !config.whitelistWords.includes(foundWord)) {
    await message.delete().catch(() => {});
    await message.member.timeout(ms("3m"), "Used banned word").catch(() => {});
    await message.author.send(`⚠️ Your message was deleted for containing a banned word: \`${foundWord}\``).catch(() => {});
    sendLog(message.guild, new EmbedBuilder()
      .setTitle("🚫 Banned Word Detected")
      .addFields(
        { name: "User", value: `${message.author.tag}`, inline: true },
        { name: "Word", value: `\`${foundWord}\``, inline: true },
        { name: "Channel", value: `${message.channel}`, inline: true }
      ).setColor("Red").setTimestamp()
    );
    return;
  }

  const hasAdminPerm = message.member.permissions.has(PermissionFlagsBits.Administrator);

  if (config.antiping.enabled) {
    if (message.mentions.everyone && !hasAdminPerm && config.antiping.blockEveryone) {
      await message.delete().catch(() => {});
      await message.member.timeout(ms(config.antiping.timeout), "@everyone/@here ping blocked").catch(() => {});
      await message.channel.send(`❌ ${message.author} You don't have permission to ping @everyone/@here.`);
      sendLog(message.guild, new EmbedBuilder()
        .setTitle("🔔 Anti-Ping — @everyone Blocked")
        .setDescription(`**${message.author.tag}** tried to ping @everyone/@here in ${message.channel}`)
        .setColor("Orange").setTimestamp()
      );
      return;
    }
    if (message.mentions.users.size >= config.antiping.threshold && !hasAdminPerm) {
      await message.delete().catch(() => {});
      await message.member.timeout(ms(config.antiping.timeout), "Mass mention").catch(() => {});
      await message.channel.send(`❌ ${message.author} Mass mention is not allowed.`);
      sendLog(message.guild, new EmbedBuilder()
        .setTitle("🔔 Anti-Ping — Mass Mention")
        .setDescription(`**${message.author.tag}** mentioned ${message.mentions.users.size} user// ============================================================
// MESSAGE AUTOMOD
// ============================================================

const INVITE_REGEX = /(discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/[a-zA-Z0-9]+/i;
const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;

client.on("messageCreate", async message => {
  if (!message.guild || message.author.bot) return;

  const msg = message.content;
  const msgLower = msg.toLowerCase();

  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    await message.reply("✅ Welcome back! Your AFK has been removed.").catch(() => {});
  }

  for (const [, user] of message.mentions.users) {
    if (afkUsers.has(user.id)) {
      const data = afkUsers.get(user.id);
      await message.reply(`💤 **${user.tag}** is currently AFK: ${data.reason}`).catch(() => {});
    }
  }

  const foundBanWord = config.banWords.find(w => msgLower.includes(w));
  const foundCensor  = config.censorWords.find(w => msgLower.includes(w));
  const foundWord = foundBanWord || foundCensor;

  if (foundWord && !config.whitelistWords.includes(foundWord)) {
    await message.delete().catch(() => {});
    await message.member.timeout(ms("3m"), "Used banned word").catch(() => {});
    await message.author.send(`⚠️ Your message was deleted for containing a banned word: \`${foundWord}\``).catch(() => {});
    sendLog(message.guild, new EmbedBuilder()
      .setTitle("🚫 Banned Word Detected")
      .addFields(
        { name: "User", value: `${message.author.tag}`, inline: true },
        { name: "Word", value: `\`${foundWord}\``, inline: true },
        { name: "Channel", value: `${message.channel}`, inline: true }
      ).setColor("Red").setTimestamp()
    );
    return;
  }

  const hasAdminPerm = message.member.permissions.has(PermissionFlagsBits.Administrator);

  if (config.antiping.enabled) {
    if (message.mentions.everyone && !hasAdminPerm && config.antiping.blockEveryone) {
      await message.delete().catch(() => {});
      await message.member.timeout(ms(config.antiping.timeout), "@everyone/@here ping blocked").catch(() => {});
      await message.channel.send(`❌ ${message.author} You don't have permission to ping @everyone/@here.`);
      sendLog(message.guild, new EmbedBuilder()
        .setTitle("🔔 Anti-Ping — @everyone Blocked")
        .setDescription(`**${message.author.tag}** tried to ping @everyone/@here in ${message.channel}`)
        .setColor("Orange").setTimestamp()
      );
      return;
    }
    if (message.mentions.users.size >= config.antiping.threshold && !hasAdminPerm) {
      await message.delete().catch(() => {});
      await message.member.timeout(ms(config.antiping.timeout), "Mass mention").catch(() => {});
      await message.channel.send(`❌ ${message.author} Mass mention is not allowed.`);
      sendLog(message.guild, new EmbedBuilder()
        .setTitle("🔔 Anti-Ping — Mass Mention")
        .setDescription(`**${message.author.tag}** mentioned ${message.mentions.users.size} users in ${message.channel}`)
        .setColor("Orange").setTimestamp()
      );
      return;
    }
  }

  if (config.antispam.enabled && !hasAdminPerm) {
    if (config.antispam.inviteLinks && INVITE_REGEX.test(msg)) {
      await message.delete().catch(() => {});
      await message.member.timeout(ms(config.antispam.timeout), "Sent invite link").catch(() => {});
      await message.channel.send(`❌ ${message.author} Posting invite links is not allowed.`);
      sendLog(message.guild, new EmbedBuilder()
        .setTitle("🔗 Anti-Spam — Invite Link Blocked")
        .setDescription(`**${message.author.tag}** posted an invite link in ${message.channel}`)
        .setColor("Orange").setTimestamp()
      );
      return;
    }

    const emojiCount = (msg.match(EMOJI_REGEX) || []).length;
    if (emojiCount >= config.antispam.emojiThreshold) {
      await message.delete().catch(() => {});
      await message.member.timeout(ms(config.antispam.timeout), "Emoji spam").catch(() => {});
      await message.channel.send(`❌ ${message.author} Too many emojis in one message.`);
      return;
    }

    if (msg.length >= config.antispam.capsMinLength) {
      const upperCount = (msg.match(/[A-Z]/g) || []).length;
      const capsRatio = (upperCount / msg.replace(/[^a-zA-Z]/g, "").length) * 100;
      if (capsRatio >= config.antispam.capsPercent) {
        await message.delete().catch(() => {});
        await message.channel.send(`❌ ${message.author} Please don't use excessive caps.`);
        return;
      }
    }

    if (!dupMap.has(message.author.id)) dupMap.set(message.author.id, []);
    const dups = dupMap.get(message.author.id);
    dups.push(msg);
    if (dups.length > config.antispam.dupThreshold) dups.shift();
    if (dups.length >= config.antispam.dupThreshold && dups.every(m => m === msg)) {
      await message.member.timeout(ms(config.antispam.timeout), "Duplicate message spam").catch(() => {});
      await message.channel.send(`❌ ${message.author} You have been timed out for spamming duplicate messages.`);
      dupMap.set(message.author.id, []);
      return;
    }

    if (!spamMap.has(message.author.id)) spamMap.set(message.author.id, []);
    const spamData = spamMap.get(message.author.id);
    spamData.push(Date.now());
    const recent = spamData.filter(x => Date.now() - x < config.antispam.timeWindow);
    spamMap.set(message.author.id, recent);
    if (recent.length >= config.antispam.messageThreshold) {
      await message.member.timeout(ms(config.antispam.timeout), "Message spam").catch(() => {});
      await message.channel.send(`❌ ${message.author} You have been timed out for spamming.`);
      spamMap.set(message.author.id, []);
    }
  }

  if (config.antimage.enabled && message.attachments.size > 0 && !hasAdminPerm) {
    await message.delete().catch(() => {});
    await message.channel.send(`❌ ${message.author} Image/file uploads are not allowed.`);
  }
});

// ============================================================
// INTERACTIONS
// ============================================================

client.on("interactionCreate", async interaction => {

  if (interaction.isButton()) {
    if (interaction.customId === "verify") {
      await interaction.deferReply({ ephemeral: true });
      const role = interaction.guild.roles.cache.get(config.verifiedRole);
      if (!role) return await interaction.editReply("❌ Verified role not found. Please run /setup first.");
      if (interaction.member.roles.cache.has(role.id)) return await interaction.editReply("✅ You are already verified!");
      await interaction.member.roles.add(role).catch(() => {});
      return await interaction.editReply("✅ You have been verified! Welcome to the server.");
    }
    return;
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === "setup_modal") {
      const logsChannel   = interaction.fields.getTextInputValue("logs_channel").trim();
      const verifyChannel = interaction.fields.getTextInputValue("verify_channel").trim();
      const verifiedRole  = interaction.fields.getTextInputValue("verified_role").trim();
      const ownerId       = interaction.fields.getTextInputValue("owner_id").trim();
      const secondOwner   = interaction.fields.getTextInputValue("second_owner_id").trim();

      config.logsChannel   = logsChannel;
      config.verifyChannel = verifyChannel;
      config.verifiedRole  = verifiedRole;
      config.ownerId       = ownerId;
      config.secondOwnerId = secondOwner;

      const checkId = (id) => /^\d{17,20}$/.test(id) ? "✅" : "⚠️";

      return await interaction.reply({
        embeds: [new EmbedBuilder()
          .setTitle("⚙️ Bot Setup Complete!")
          .setDescription("All config values updated. Use Railway env vars for permanent config.")
          .addFields(
            { name: `${checkId(logsChannel)} Logs Channel`,    value: `<#${logsChannel}>`,   inline: true },
            { name: `${checkId(verifyChannel)} Verify Channel`, value: `<#${verifyChannel}>`, inline: true },
            { name: `${checkId(verifiedRole)} Verified Role`,   value: `<@&${verifiedRole}>`, inline: true },
            { name: `${checkId(ownerId)} Owner`,               value: `<@${ownerId}>`,        inline: true },
            { name: `${checkId(secondOwner)} Second Owner`,    value: `<@${secondOwner}>`,    inline: true }
          )
          .setColor("Green").setTimestamp()
        ],
        ephemeral: true
      });
    }
    return;
  }

  if (!interaction.isChatInputCommand()) return;
  const { commandName } = interaction;

  if (commandName === "setup") {
    const modal = new ModalBuilder().setCustomId("setup_modal").setTitle("🛠️ Bot Setup — Enter Your IDs");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("logs_channel").setLabel("Logs Channel ID").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 1234567890123456789").setValue(config.logsChannel !== "LOG_CHANNEL_ID" ? config.logsChannel : "").setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("verify_channel").setLabel("Verify Channel ID").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 1234567890123456789").setValue(config.verifyChannel !== "VERIFY_CHANNEL_ID" ? config.verifyChannel : "").setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("verified_role").setLabel("Verified Role ID").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 1234567890123456789").setValue(config.verifiedRole !== "VERIFIED_ROLE_ID" ? config.verifiedRole : "").setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("owner_id").setLabel("Your Discord ID (Owner)").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 1234567890123456789").setValue(config.ownerId !== "YOUR_OWNER_ID" ? config.ownerId : "").setRequired(true)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("second_owner_id").setLabel("Second Owner / Co-Admin ID").setStyle(TextInputStyle.Short).setPlaceholder("e.g. 1234567890123456789").setValue(config.secondOwnerId !== "SECOND_OWNER_ID" ? config.secondOwnerId : "").setRequired(true))
    );
    return await interaction.showModal(modal);
  }

  if (commandName === "security") {
    const s = (b) => b ? "🟢 **ON**" : "🔴 **OFF**";
    return await interaction.reply({ embeds: [new EmbedBuilder()
      .setTitle("🛡️ Security Module Status")
      .addFields(
        { name: "🚀 Anti-Nuke", value: `${s(config.antinuke.enabled)}\n> Bans: \`${config.antinuke.banThreshold}\` | Kicks: \`${config.antinuke.kickThreshold}\` | Ch.Del: \`${config.antinuke.channelDeleteThreshold}\`\n> Role Del: \`${config.antinuke.roleDeleteThreshold}\` | Webhook: \`${config.antinuke.webhookThreshold}\`\n> Window: \`${config.antinuke.timeWindow/1000}s\` | Action: \`${config.antinuke.action.toUpperCase()}\`\n> Whitelist: \`${config.antinuke.whitelist.size} users\`` },
        { name: "🤖 Anti-Bot",  value: `${s(config.antibot.enabled)}\n> Action: \`${config.antibot.action.toUpperCase()}\` | Whitelist: \`${config.antibot.whitelist.size} bots\`` },
        { name: "⚡ Anti-Spam", value: `${s(config.antispam.enabled)}\n> Rate: \`${config.antispam.messageThreshold} msgs/${config.antispam.timeWindow/1000}s\` | Dup: \`${config.antispam.dupThreshold}x\`\n> Caps: \`${config.antispam.capsPercent}%\` | Emojis: \`${config.antispam.emojiThreshold}\` | Invites: ${s(config.antispam.inviteLinks)}` },
        { name: "🔔 Anti-Ping", value: `${s(config.antiping.enabled)}\n> Max mentions: \`${config.antiping.threshold}\` | Block @everyone: ${s(config.antiping.blockEveryone)}` },
        { name: "🖼️ Anti-Image", value: s(config.antimage.enabled) },
        { name: "🚫 Bad Word Filter", value: `🟢 **ON** — \`${config.banWords.length}\` banned words` },
        { name: "🆕 Alt Detection", value: `🟢 **ON** — accounts < 7 days flagged` },
        { name: "💤 AFK System", value: `🟢 **ON** — \`${afkUsers.size}\` active AFKs` }
      ).setColor("Blue").setTimestamp()
    ]});
  }

  if (commandName === "antinuke") {
    const action = interaction.options.getString("action");
    const user   = interaction.options.getUser("user");
    if (action === "add") {
      if (!user) return await interaction.reply({ content: "❌ Provide a user.", ephemeral: true });
      config.antinuke.whitelist.add(user.id);
      return await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ Anti-Nuke Whitelist").setDescription(`**${user.tag}** added.`).setColor("Green")] });
    }
    if (action === "remove") {
      if (!user) return await interaction.reply({ content: "❌ Provide a user.", ephemeral: true });
      config.antinuke.whitelist.delete(user.id);
      return await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ Anti-Nuke Whitelist").setDescription(`**${user.tag}** removed.`).setColor("Orange")] });
    }
    if (action === "list") {
      const list = [...config.antinuke.whitelist].map(id => `<@${id}>`).join("\n") || "Empty";
      return await interaction.reply({ embeds: [new EmbedBuilder().setTitle("📋 Anti-Nuke Whitelist").setDescription(list).setColor("Blue")] });
    }
  }

  if (commandName === "antibot") {
    const action = interaction.options.getString("action");
    const bot    = interaction.options.getUser("bot");
    if (action === "add") {
      if (!bot) return await interaction.reply({ content: "❌ Provide a bot user.", ephemeral: true });
      config.antibot.whitelist.add(bot.id);
      return await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ Anti-Bot Whitelist").setDescription(`**${bot.tag}** whitelisted.`).setColor("Green")] });
    }
    if (action === "remove") {
      if (!bot) return await interaction.reply({ content: "❌ Provide a bot user.", ephemeral: true });
      config.antibot.whitelist.delete(bot.id);
      return await interaction.reply({ embeds: [new EmbedBuilder().setTitle("✅ Anti-Bot Whitelist").setDescription(`**${bot.tag}** removed.`).setColor("Orange")] });
    }
    if (action === "list") {
      const list = [...config.antibot.whitelist].map(id => `<@${id}>`).join("\n") || "Empty";
      return await interaction.reply({ embeds: [new EmbedBuilder().setTitle("📋 Anti-Bot Whitelist").setDescription(list).setColor("Blue")] });
    }
  }

  if (commandName === "togglemodule") {
    const mod   = interaction.options.getString("module");
    const state = interaction.options.getString("state") === "on";
    if (mod === "antinuke") config.antinuke.enabled = state;
    if (mod === "antibot")  config.antibot.enabled  = state;
    if (mod === "antispam") config.antispam.enabled = state;
    if (mod === "antiping") config.antiping.enabled = state;
    if (mod === "antimage") config.antimage.enabled = state;
    return await interaction.reply({ embeds: [new EmbedBuilder()
      .setTitle("⚙️ Module Updated")
      .setDescription(`**${mod.toUpperCase()}** is now **${state ? "ON 🟢" : "OFF 🔴"}**`)
      .setColor(state ? "Green" : "Red")]
    });
  }

  if (commandName === "afk") {
    const reason = interaction.options.getString("reason") || "AFK";
    afkUsers.set(interaction.user.id, { reason });
    return await interaction.reply(`💤 AFK set: **${reason}**`);
  }

  if (commandName === "say") {
    await interaction.reply({ content: "✅ Done!", ephemeral: true });
    await interaction.channel.send(interaction.options.getString("text"));
  }

  if (commandName === "announcement") {
    await interaction.reply({ content: "✅ Sent!", ephemeral: true });
    await interaction.channel.send({ embeds: [new EmbedBuilder().setTitle("📢 Announcement").setDescription(interaction.options.getString("text")).setColor("Blue").setTimestamp()] });
  }

  if (commandName === "dm") {
    await interaction.deferReply({ ephemeral: true });
    const user = interaction.options.getUser("user");
    try {
      await user.send(interaction.options.getString("text"));
      return await interaction.editReply(`✅ DM sent to **${user.tag}**!`);
    } catch { return await interaction.editReply(`❌ Could not DM **${user.tag}**.`); }
  }

  if (commandName === "dmall") {
    if (!isOwner(interaction.user.id)) return await interaction.reply({ content: "❌ Owner only.", ephemeral: true });
    await interaction.deferReply({ ephemeral: true });
    const text = interaction.options.getString("text");
    let count = 0;
    const members = await interaction.guild.members.fetch();
    for (const [, m] of members) { if (!m.user.bot) { await m.send(text).catch(() => {}); count++; } }
    return await interaction.editReply(`✅ DM sent to **${count}** members!`);
  }

  if (commandName === "ban") {
    await interaction.deferReply();
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) return await interaction.editReply("❌ Member not found.");
    try {
      await member.ban({ reason });
      sendLog(interaction.guild, new EmbedBuilder().setTitle("🔨 Member Banned").addFields({ name: "User", value: user.tag, inline: true }, { name: "Mod", value: interaction.user.tag, inline: true }, { name: "Reason", value: reason }).setColor("Red").setTimestamp());
      return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🔨 Banned").setDescription(`**${user.tag}** banned.\nReason: ${reason}`).setColor("Red")] });
    } catch { return await interaction.editReply("❌ Could not ban."); }
  }

  if (commandName === "kick") {
    await interaction.deferReply();
    const user = interaction.options.getUser("user");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) return await interaction.editReply("❌ Member not found.");
    try {
      await member.kick(reason);
      sendLog(interaction.guild, new EmbedBuilder().setTitle("👢 Member Kicked").addFields({ name: "User", value: user.tag, inline: true }, { name: "Mod", value: interaction.user.tag, inline: true }, { name: "Reason", value: reason }).setColor("Orange").setTimestamp());
      return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("👢 Kicked").setDescription(`**${user.tag}** kicked.\nReason: ${reason}`).setColor("Orange")] });
    } catch { return await interaction.editReply("❌ Could not kick."); }
  }

  if (commandName === "timeout") {
    await interaction.deferReply();
    const user = interaction.options.getUser("user");
    const timeStr = interaction.options.getString("time");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) return await interaction.editReply("❌ Member not found.");
    const duration = ms(timeStr);
    if (!duration) return await interaction.editReply("❌ Invalid time. Example: `10m`, `1h`");
    try {
      await member.timeout(duration, reason);
      return await interaction.editReply({ embeds: [new EmbedBuilder().setTitle("🔇 Timed Out").setDescription(`**${user.tag}** timed out for **${timeStr}**.\nReason: ${reason}`).setColor("Orange")] });
    } catch { return await interaction.editReply("❌ Could not timeout."); }
  }

  if (commandName === "untimeout") {
    await interaction.deferReply();
    const user = interaction.options.getUser("user");
    const member = interaction.guild.members.cache.get(user.id);
    if (!member) return await interaction.editReply("❌ Member not found.");
    try { await member.timeout(null); return await interaction.editReply(`✅ Timeout removed from **${user.tag}**.`); }
    catch { return await interaction.editReply("❌ Could not remove timeout."); }
  }

  if (commandName === "unban") {
    await interaction.deferReply();
    const u
