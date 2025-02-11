const express = require("express");
const axios = require("axios");
const { addonBuilder } = require("stremio-addon-sdk");

const PORT = process.env.PORT || 8080;
const IPTV_DNS = "http://pfsv.io";
const IPTV_USER = "ldalton2";
const IPTV_PASS = "1qaz2wsx";

const M3U_URL = `${IPTV_DNS}/get.php?username=${IPTV_USER}&password=${IPTV_PASS}&type=m3u_plus&output=mpegts`;

console.log(`✅ Usando URL M3U: ${M3U_URL}`);

// 🚀 Teste para garantir que o stremio-addon-sdk está instalado corretamente
try {
    require.resolve("stremio-addon-sdk");
    console.log("✅ stremio-addon-sdk está instalado corretamente!");
} catch (e) {
    console.error("❌ ERRO: stremio-addon-sdk NÃO está instalado corretamente!", e);
    process.exit(1);
}

// Criando o Manifesto do Addon
const manifest = {
    id: "iptv.stremio.addon",
    version: "1.0.0",
    name: "IPTV Addon Stremio",
    description: "Filmes e séries do IPTV no Stremio",
    resources: ["catalog", "meta", "stream"],
    types: ["movie", "series"],
    idPrefixes: ["custom"],
    catalogs: [
        {
            type: "movie",
            id: "iptv-movies",
            name: "Filmes IPTV"
        },
        {
            type: "series",
            id: "iptv-series",
            name: "Séries IPTV"
        }
    ]
};

// Criar o Addon corretamente
let builder;
try {
    builder = new addonBuilder(manifest);
    console.log("✅ addonBuilder inicializado corretamente!");
} catch (err) {
    console.error("❌ ERRO: Falha ao criar o addonBuilder!", err);
    process.exit(1);
}

// 🚀 Função para carregar a lista M3U
const fs = require("fs");
const path = require("path");

async function getM3UData() {
    try {
        console.log("🔄 Baixando a lista M3U...");

        // Criando um caminho temporário para salvar o arquivo M3U
        const tempFilePath = path.join(__dirname, "tv_channels.m3u");

        // Baixando o arquivo M3U e salvando localmente
        const response = await axios({
            method: "GET",
            url: M3U_URL,
            responseType: "stream",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Referer": IPTV_DNS
            }
        });

        const writer = fs.createWriteStream(tempFilePath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on("finish", resolve);
            writer.on("error", reject);
        });

        console.log("✅ Arquivo M3U baixado com sucesso!");

        // Lendo o arquivo salvo
        const m3uData = fs.readFileSync(tempFilePath, "utf-8");
        const lines = m3uData.split("\n");

        let movies = [];
        let currentTitle = "";

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith("#EXTINF")) {
                currentTitle = lines[i].split(",")[1] || "Filme Desconhecido";
            } else if (lines[i].startsWith("http")) {
                movies.push({
                    id: "custom_" + encodeURIComponent(lines[i]),
                    type: "movie",
                    name: currentTitle,
                    poster: "https://via.placeholder.com/150",
                    description: "Filme IPTV"
                });
            }
        }

        if (movies.length === 0) {
            console.error("❌ Nenhum filme encontrado na lista M3U!");
        } else {
            console.log(`✅ ${movies.length} filmes foram carregados da M3U.`);
        }

        return movies;
    } catch (error) {
        console.error("❌ Erro ao carregar M3U:", error.message);
        return [];
    }
}

// 🚀 Definir catálogo de filmes e séries
builder.defineCatalogHandler(async ({ type, id }) => {
    console.log(`📡 Requisição de catálogo: ${type}, ID: ${id}`);
    const movies = await getM3UData();
    return { metas: movies };
});

// 🚀 Definir metadados do filme
builder.defineMetaHandler(async ({ type, id }) => {
    return {
        meta: {
            id: id,
            type: "movie",
            name: "Filme IPTV",
            poster: "https://via.placeholder.com/150",
            description: "Filme transmitido via IPTV"
        }
    };
});

// 🚀 Definir streams para cada filme
builder.defineStreamHandler(async ({ type, id }) => {
    return {
        streams: [
            {
                title: "🎬 IPTV Stream",
                url: decodeURIComponent(id.replace("custom_", ""))
            }
        ]
    };
});

// 🚀 Criando o servidor Express
const app = express();

// Criar a interface do addon
let addonInterface;
try {
    addonInterface = builder.getInterface();
    console.log("✅ addonInterface inicializado com sucesso!");
} catch (err) {
    console.error("❌ ERRO: addonInterface não foi inicializado corretamente!", err);
    process.exit(1);
}

// Garantir que o `router` foi carregado corretamente
if (!addonInterface || !addonInterface.router) {
    console.error("❌ ERRO CRÍTICO: O router do addonInterface não foi carregado corretamente.");
    console.error("📢 Tentando solução alternativa...");

    // Tentativa de carregar manualmente as rotas
    app.get("/manifest.json", (req, res) => {
        res.json(manifest);
    });

    app.get("/catalog/:type/:id.json", async (req, res) => {
        console.log(`📡 Requisição de catálogo manual: ${req.params.type}, ID: ${req.params.id}`);
        const movies = await getM3UData();
        res.json({ metas: movies });
    });

    app.get("/meta/:type/:id.json", (req, res) => {
        res.json({
            meta: {
                id: req.params.id,
                type: "movie",
                name: "Filme IPTV",
                poster: "https://via.placeholder.com/150",
                description: "Filme transmitido via IPTV"
            }
        });
    });

    app.get("/stream/:type/:id.json", (req, res) => {
        res.json({
            streams: [
                {
                    title: "🎬 IPTV Stream",
                    url: decodeURIComponent(req.params.id.replace("custom_", ""))
                }
            ]
        });
    });

} else {
    console.log("✅ Router do addonInterface carregado com sucesso!");
    app.use("/", addonInterface.router);
}

// ✅ 🚀 Mantendo o servidor ativo
setInterval(() => {
    console.log("🟢 Mantendo o servidor ativo...");
}, 1000 * 60 * 5);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Addon rodando em http://0.0.0.0:${PORT}/manifest.json`);
});
