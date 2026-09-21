/**
 * @file groupGames.js
 * @description Extended free-API integrations for fun & engaging group commands.
 *
 * All APIs verified live and key-free:
 *  - v2.jokeapi.dev          (jokes w/ flags, safe-mode)
 *  - api.chucknorris.io      (chuck norris jokes)
 *  - opentdb.com             (trivia, categories)
 *  - the-trivia-api.com      (trivia with difficulty)
 *  - thecatapi.com / cataas  (cat images, cat-with-text)
 *  - dog.ceo                 (dog images by breed)
 *  - pokeapi.co              (pokemon data + sprites)
 *  - agify / genderize / nationalize (name predictions)
 *  - api.adviceslip.com      (advice)
 *  - uselessfacts.jsph.pl    (useless facts)
 *  - open-meteo.com          (weather, no key)
 *  - exchangerate.host       (currency, no key)
 */

const axios = require('axios');

const TIMEOUT = 12000;

/** Safe-mode joke from JokeAPI (two-part or single). */
async function getSafeJoke(category = 'Any') {
    try {
        const res = await axios.get(`https://v2.jokeapi.dev/joke/${category}?safe-mode`, { timeout: TIMEOUT });
        const j = res.data;
        if (!j || j.error) return null;
        if (j.type === 'twopart') return `😂 *${j.setup}*\n\n...${j.delivery}`;
        return `😂 ${j.joke}`;
    } catch (e) {
        return null;
    }
}

/** Chuck Norris joke. */
async function getChuckNorrisJoke() {
    try {
        const res = await axios.get('https://api.chucknorris.io/jokes/random', { timeout: TIMEOUT });
        return res.data?.value ? `💪 *Chuck Norris Fact*\n\n${res.data.value}` : null;
    } catch (e) {
        return null;
    }
}

/** Random trivia question from OpenTDB (multiple choice). */
async function getTriviaQuestion(categoryId) {
    try {
        const url = categoryId
            ? `https://opentdb.com/api.php?amount=1&category=${categoryId}&type=multiple`
            : 'https://opentdb.com/api.php?amount=1&type=multiple';
        const res = await axios.get(url, { timeout: TIMEOUT });
        const r = res.data?.results?.[0];
        if (!r) return null;

        const clean = (s) => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&eacute;/g, 'é');
        const question = clean(r.question);
        const correct = clean(r.correct_answer);
        const options = r.incorrect_answers.map(clean);
        // Insert correct answer at random position
        const pos = Math.floor(Math.random() * (options.length + 1));
        options.splice(pos, 0, correct);

        const letters = ['A', 'B', 'C', 'D'];
        return {
            question,
            correct,
            options: options.map((o, i) => `${letters[i]}. ${o}`),
            answerLetter: letters[pos],
            category: r.category,
            difficulty: r.difficulty
        };
    } catch (e) {
        return null;
    }
}

/** OpenTDB category list (id -> name). */
async function getTriviaCategories() {
    try {
        const res = await axios.get('https://opentdb.com/api_category.php', { timeout: TIMEOUT });
        return res.data?.trivia_categories || [];
    } catch (e) {
        return [];
    }
}

/** Random dog image by breed. */
async function getDogImage(breed) {
    try {
        const url = breed
            ? `https://dog.ceo/api/breed/${encodeURIComponent(breed.toLowerCase())}/images/random`
            : 'https://dog.ceo/api/breeds/image/random';
        const res = await axios.get(url, { timeout: TIMEOUT });
        if (res.data?.status === 'success') return res.data.message;
        return null;
    } catch (e) {
        return null;
    }
}

/** Random cat image. */
async function getCatImage() {
    try {
        const res = await axios.get('https://api.thecatapi.com/v1/images/search', { timeout: TIMEOUT });
        return res.data?.[0]?.url || null;
    } catch (e) {
        return null;
    }
}

/** Cat image with custom text (cataas). Returns the direct image URL. */
async function getCatSays(text) {
    try {
        // cataas serves the image directly; verify it renders
        const url = `https://cataas.com/cat/says/${encodeURIComponent(text)}`;
        const res = await axios.get(url, {
            timeout: TIMEOUT,
            responseType: 'arraybuffer',
            params: { width: 600, height: 450 }
        });
        if (res.status === 200) return `https://cataas.com/cat/says/${encodeURIComponent(text)}?width=600&height=450`;
        return null;
    } catch (e) {
        return null;
    }
}

/** Pokemon info + sprite. */
async function getPokemon(name) {
    try {
        const res = await axios.get(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(name.toLowerCase())}`, { timeout: TIMEOUT });
        const p = res.data;
        if (!p) return null;
        const types = p.types.map(t => t.type.name).join(', ');
        const abilities = p.abilities.slice(0, 3).map(a => a.ability.name).join(', ');
        return {
            name: p.name,
            id: p.id,
            types,
            abilities,
            height: (p.height / 10).toFixed(1) + ' m',
            weight: (p.weight / 10).toFixed(1) + ' kg',
            sprite: p.sprites?.other?.['official-artwork']?.front_default || p.sprites?.front_default
        };
    } catch (e) {
        return null;
    }
}

/** Name age prediction (agify). */
async function predictAge(name) {
    try {
        const res = await axios.get('https://api.agify.io', { params: { name }, timeout: TIMEOUT });
        return res.data?.age ? { name: res.data.name, age: res.data.age, count: res.data.count } : null;
    } catch (e) {
        return null;
    }
}

/** Name gender prediction (genderize). */
async function predictGender(name) {
    try {
        const res = await axios.get('https://api.genderize.io', { params: { name }, timeout: TIMEOUT });
        return res.data?.gender ? { name: res.data.name, gender: res.data.gender, probability: res.data.probability } : null;
    } catch (e) {
        return null;
    }
}

/** Name nationality prediction (nationalize). */
async function predictNationality(name) {
    try {
        const res = await axios.get('https://api.nationalize.io', { params: { name }, timeout: TIMEOUT });
        const top = res.data?.country?.slice(0, 2) || [];
        if (top.length === 0) return null;
        return {
            name: res.data.name,
            countries: top.map(c => `${c.country_id} (${Math.round(c.probability * 100)}%)`)
        };
    } catch (e) {
        return null;
    }
}

/** Advice slip. */
async function getAdviceSlip() {
    try {
        const res = await axios.get('https://api.adviceslip.com/advice', { timeout: TIMEOUT });
        return res.data?.slip?.advice ? `💡 *Advice #${res.data.slip.id}*\n\n"${res.data.slip.advice}"` : null;
    } catch (e) {
        return null;
    }
}

/** Useless (but fun) fact. */
async function getUselessFact() {
    try {
        const res = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random', { timeout: TIMEOUT });
        return res.data?.text ? `🤓 *Did you know?*\n\n${res.data.text}` : null;
    } catch (e) {
        return null;
    }
}

/** Currency conversion via open.er-api.com (free, no key). */
async function convertCurrency(from, to, amount = 1) {
    try {
        const res = await axios.get(`https://open.er-api.com/v6/latest/${from.toUpperCase()}`, { timeout: TIMEOUT });
        const rates = res.data?.rates;
        const toCode = to.toUpperCase();
        if (rates && rates[toCode]) {
            const rate = rates[toCode];
            return {
                from: from.toUpperCase(),
                to: toCode,
                amount,
                result: amount * rate,
                rate
            };
        }
        return null;
    } catch (e) {
        return null;
    }
}

module.exports = {
    getSafeJoke,
    getChuckNorrisJoke,
    getTriviaQuestion,
    getTriviaCategories,
    getDogImage,
    getCatImage,
    getCatSays,
    getPokemon,
    predictAge,
    predictGender,
    predictNationality,
    getAdviceSlip,
    getUselessFact,
    convertCurrency
};
