const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 1. IN-MEMORY DATABASE (Users & Inventories)
// ==========================================
const database = {
    users: {
        1: {
            username: "Player1",
            avatarType: "R15", // "R6" or "R15"
            colors: {
                headColorId: 24,
                torsoColorId: 23,
                rightArmColorId: 24,
                leftArmColorId: 24,
                rightLegColorId: 119,
                leftLegColorId: 119
            },
            // List of equipped Roblox Asset IDs (Accessories, Hair, Shirts, Pants)
            equippedAccessories: [
                1028811,   // Domino Crown
                1374523,   // Blue Hair
                144076358, // Valkyrie Helm
                144076760  // Classic Shirt
            ]
        }
    },
    games: [
        { id: 1818, name: "Crossroads (2019 Classic)", maxPlayers: 10, serverPort: 53640, serverIp: "127.0.0.1" }
    ]
};

// ==========================================
// 2. WEBSITE ROUTES (HTML Interface)
// ==========================================
app.get('/', (req, res) => {
    const user = database.users[1];
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>2019 Roblox Revival</title>
            <style>
                body { font-family: Arial, sans-serif; background: #232527; color: #fff; margin: 40px; }
                .card { background: #191b1d; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
                a.btn { background: #00a2ff; color: #fff; padding: 10px 15px; text-decoration: none; border-radius: 4px; display: inline-block; }
                code { background: #000; padding: 4px 8px; border-radius: 4px; }
            </style>
        </head>
        <body>
            <h1>2019 Roblox Revival Dashboard</h1>
            
            <div class="card">
                <h2>Server Status: <span style="color: #00FF00;">ONLINE</span></h2>
                <p>Running on Port: <code>${PORT}</code></p>
            </div>

            <div class="card">
                <h2>Active Character Setup</h2>
                <p><strong>Username:</strong> ${user.username}</p>
                <p><strong>Rig Type:</strong> ${user.avatarType}</p>
                <p><strong>Equipped Asset IDs:</strong> ${user.equippedAccessories.join(', ')}</p>
            </div>

            <div class="card">
                <h2>Launch Game</h2>
                <p>Launch URL for 2019 Client:</p>
                <code>RobloxPlayerBeta.exe -t 1 -j "http://localhost/game/join.ashx?placeId=1818&userId=1"</code>
            </div>
        </body>
        </html>
    `);
});

// ==========================================
// 3. 2019 CLIENT API ENDPOINTS
// ==========================================

// Game Join Script (Called by 2019 Client on boot)
app.get('/game/join.ashx', (req, res) => {
    const placeId = parseInt(req.query.placeId) || 1818;
    const userId = parseInt(req.query.userId) || 1;
    const user = database.users[userId] || database.users[1];
    const gameServer = database.games.find(g => g.id === placeId) || database.games[0];

    const host = req.headers.host;

    // Roblox 2019 Lua join string
    const joinScript = `-- 2019 Client Join Script
game:GetService("RunService"):SetRobloxVersion("2019")
local NetworkClient = game:GetService("NetworkClient")
local Players = game:GetService("Players")

local player = Players:CreateLocalPlayer(${userId})
player.Name = "${user.username}"
player:SetSuperSafeChat(false)

player.CharacterAppearance = "http://${host}/v1.1/avatar-fetch?userId=${userId}"

local function onConnected(peer, replicator)
    print("Successfully connected to 2019 server!")
end

local function onConnectionFailed(peer, code, reason)
    print("Connection failed: " .. tostring(reason))
end

NetworkClient.ConnectionAccepted:Connect(onConnected)
NetworkClient.ConnectionFailed:Connect(onConnectionFailed)

NetworkClient:Connect("${gameServer.serverIp}", ${gameServer.serverPort}, 0, 0)
`;

    res.setHeader('Content-Type', 'text/plain');
    res.send(joinScript);
});

// Avatar & Accessory Fetch API
app.get('/v1.1/avatar-fetch', (req, res) => {
    const userId = parseInt(req.query.userId) || 1;
    const user = database.users[userId] || database.users[1];

    res.json({
        resolvedAvatarType: user.avatarType, // "R15" or "R6"
        equippedGearVersionIds: [],
        backpackGearVersionIds: [],
        assetAndOperationIds: user.equippedAccessories, // List of equipped accessories & clothing IDs
        animationAssetIds: {
            idle: 2510196951,
            walk: 2510198475,
            run: 2510198475
        },
        bodyColorIds: user.colors,
        scales: {
            height: 1.0,
            width: 1.0,
            head: 1.0,
            depth: 1.0,
            proportion: 0.0,
            bodyType: 0.0
        }
    });
});

// Accessory Modifying Route (Add or Remove Accessories)
app.post('/api/avatar/equip', (express.json()), (req, res) => {
    const { userId, assetId } = req.body;
    const user = database.users[userId || 1];

    if (!user.equippedAccessories.includes(assetId)) {
        user.equippedAccessories.push(assetId);
        return res.json({ success: true, message: `Equipped asset ${assetId}`, equipped: user.equippedAccessories });
    }

    res.json({ success: false, message: "Asset already equipped." });
});

// Asset Proxy Endpoint (Downloads and serves accessory models & textures)
app.get('/asset/', async (req, res) => {
    const assetId = req.query.id;

    if (!assetId) {
        return res.status(400).send("Asset ID missing.");
    }

    try {
        const response = await axios.get(`https://assetdelivery.roblox.com/v1/asset/?id=${assetId}`, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Roblox/WinInet'
            }
        });

        res.setHeader('Content-Type', 'text/plain');
        res.send(response.data);
    } catch (error) {
        console.error(`Error loading asset ${assetId}:`, error.message);
        res.status(404).send("Failed to load asset.");
    }
});

// ==========================================
// 4. START SERVER
// ==========================================
app.listen(PORT, () => {
    console.log(`==========================================`);
    console.log(` 2019 Roblox Revival Server Active`);
    console.log(` Web Dashboard: http://localhost:${PORT}`);
    console.log(` Join Endpoint: http://localhost:${PORT}/game/join.ashx`);
    console.log(`==========================================`);
});
