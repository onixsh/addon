const express = require("express");
const axios = require("axios");
const { addonBuilder } = require("stremio-addon-sdk");

const PORT = process.env.PORT || 8080;
const IPTV_DNS = process.env.IPTV_DNS || "http://equipentmult.com";
const IPTV_USER = process.env.IPTV_USER || "706475379";
const IPTV_PASS = process.env.IPTV_PASS || "Y741g4229D";

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
async function getM3UData() {
    try {
        console.log("🔄 Baixando lista M3U...");
        const response = await axios.get(M3U_URL, { responseType: "text" });
        const lines = response.data.split("\n");

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

        console.log(`✅ Encontrados ${movies.length} filmes na lista.`);
        return movies;
    } catch (error) {
        console.error("❌ Erro ao carregar M3U:", error);
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
    
    // Tentativa de carregar manualmente o middleware
    app.get("/", (req, res) => res.send("Stremio Addon ativo"));
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
