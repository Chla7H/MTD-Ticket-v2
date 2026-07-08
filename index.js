const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ChannelType, 
    PermissionFlagsBits,
    ActivityType 
} = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// ==================== CONFIGURATION ====================
const TOKEN = ''; 
const STAFF_ROLE_ID = '';
const CATEGORY_ID = '';

const EMOJIS = {
    megaShield: '<:MegaShield:1524422754181583078>',
    antiCheat: '<:shield:1524422576225652817>',
    staffApply: '<:staff:1524421413593809130>',
    report: '<:ticket:1524422586203635972>'
};
// =======================================================

// Registering Slash Commands & Streaming Presence
client.once('ready', async () => {
    console.log(`🛡️ Mega Shield Bot is successfully online as ${client.user.tag}!`);
    
    const commands = [
        { name: 'setup-tickets', description: 'Deploy the Ticket Panel matching' },
        { 
            name: 'add', 
            description: 'Add a member to the current ticket',
            options: [{ name: 'user', type: 6, description: 'The user to add', required: true }]
        },
        { 
            name: 'remove', 
            description: 'Remove a member from the current ticket',
            options: [{ name: 'user', type: 6, description: 'The user to remove', required: true }]
        },
        { name: 'close', description: 'Close and delete the current ticket channel' }
    ];

    try {
        await client.application.commands.set(commands);
        console.log('✅ All Slash Commands registered successfully!');
    } catch (err) {
        console.error('Error registering slash commands:', err);
    }

    client.user.setPresence({
        activities: [{ 
            name: 'Discord.gg/MegaShield ', 
            type: ActivityType.Streaming, 
            url: 'https://www.twitch.tv/twitch' 
        }],
        status: 'online',
    });
});

// --- SLASH COMMANDS HANDLER ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guild, channel, options, member } = interaction;

    // 1. /setup-tickets
    if (commandName === 'setup-tickets') {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ You need Administrator permissions to run this setup.", ephemeral: true });
        }

        const TICKET_BANNER = 'https://i.imgur.com/IOlu9sX.png';

        const buttonsRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ticket_buy').setLabel('Buy Anti-Cheat').setStyle(ButtonStyle.Secondary).setEmoji(EMOJIS.antiCheat),
            new ButtonBuilder().setCustomId('ticket_apply').setLabel('Apply Staff').setStyle(ButtonStyle.Secondary).setEmoji(EMOJIS.staffApply),
            new ButtonBuilder().setCustomId('ticket_report').setLabel('Report & Support').setStyle(ButtonStyle.Secondary).setEmoji(EMOJIS.report)
        );

        await interaction.channel.send({ content: TICKET_BANNER, components: [buttonsRow] });
        return interaction.reply({ content: "✅ Ticket Panel V2 deployed with Image only!", ephemeral: true });
    }

    // 2. /add [user]
    if (commandName === 'add') {
        if (!member.roles.cache.has(STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Only Support Staff can use this command.", ephemeral: true });
        }
        const targetUser = options.getUser('user');
        await channel.permissionOverwrites.edit(targetUser.id, {
            ViewChannel: true, SendMessages: true, AttachFiles: true, ReadMessageHistory: true
        });
        return interaction.reply({ content: `✅ Added ${targetUser} to this ticket channel.` });
    }

    // 3. /remove [user]
    if (commandName === 'remove') {
        if (!member.roles.cache.has(STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Only Support Staff can use this command.", ephemeral: true });
        }
        const targetUser = options.getUser('user');
        await channel.permissionOverwrites.edit(targetUser.id, { ViewChannel: false });
        return interaction.reply({ content: `❌ Removed ${targetUser} from this ticket channel.` });
    }

    // 4. /close
    if (commandName === 'close') {
        if (!member.roles.cache.has(STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Only Support Staff can close tickets.", ephemeral: true });
        }
        await interaction.reply({ content: '🔒 Ticket closing in 5 seconds...' });
        setTimeout(async () => {
            try { await channel.delete(); } catch (err) { console.error(err); }
        }, 5000);
    }
});

// --- BUTTON INTERACTION & TICKET CREATION HANDLER ---
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, guild, user, member } = interaction;

    // Button Close Handler
    if (customId === 'close_ticket') {
        if (!member.roles.cache.has(STAFF_ROLE_ID) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ Only Support Staff can close tickets.", ephemeral: true });
        }
        await interaction.reply({ content: '🔒 Ticket closing in 5 seconds...' });
        setTimeout(async () => {
            try { await interaction.channel.delete(); } catch (err) { console.error(err); }
        }, 5000);
        return;
    }

    if (!['ticket_buy', 'ticket_apply', 'ticket_report'].includes(customId)) return;

    await interaction.deferReply({ ephemeral: true });

    // Anti-Spam Check
    const safeUsername = user.username.toLowerCase().replace(/[^a-z0-x0-9]/g, '');
    const hasActiveTicket = guild.channels.cache.some(c => c.name.includes(safeUsername) && c.parentId === CATEGORY_ID);
    
    if (hasActiveTicket) {
        return interaction.editReply({ content: "❌ You already have an open ticket channel! Please close it before opening a new one." });
    }

    let ticketType = '';
    let ticketTopic = '';
    if (customId === 'ticket_buy') { ticketType = 'buy'; ticketTopic = 'Anti-Cheat Purchase'; }
    if (customId === 'ticket_apply') { ticketType = 'apply'; ticketTopic = 'Staff Application'; }
    if (customId === 'ticket_report') { ticketType = 'report'; ticketTopic = 'Report & Support'; }

    try {
        const ticketChannel = await guild.channels.create({
            name: `『🎫』${ticketType}-${safeUsername}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { 
                    id: user.id, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] 
                },
                { 
                    id: STAFF_ROLE_ID, 
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.ReadMessageHistory] 
                }
            ],
        });

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#1E1F22')
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .setDescription(
                `Hello ${user}, welcome to your secure ticket channel!\n\n` +
                `• **Department:** ${ticketTopic}\n` +
                `• **Status:** Open & Active\n\n` +
                `The **Mega Shield ®** staff team (<@&${STAFF_ROLE_ID}>) will assist you shortly. Please provide all details, receipts, or proof below.`
            )
            .setFooter({ text: 'Mega Shield ® • Secure Pipeline', iconURL: guild.iconURL() })
            .setTimestamp();

        const closeRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('Close Ticket').setStyle(ButtonStyle.Secondary).setEmoji('🔒')
        );

        await ticketChannel.send({ content: `${user} | <@&${STAFF_ROLE_ID}>`, embeds: [welcomeEmbed], components: [closeRow] });
        await interaction.editReply({ content: `✅ Ticket created successfully: ${ticketChannel}` });

    } catch (error) {
        console.error(error);
        await interaction.editReply({ content: '❌ System Error: Could not generate channel. Ensure bot has Admin privileges.' });
    }
});

client.login(TOKEN);
