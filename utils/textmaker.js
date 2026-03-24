/**
 * @file textmaker.js
 * @description Scraper for Ephoto360 and other text effect sites.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');

async function ephoto(url, text) {
    try {
        const { data } = await axios.get(url, {
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            }
        });
        const $ = cheerio.load(data);
        const serverId = $('#build_server').val();
        const serverIdValue = $('#build_server_id').val();
        const token = $('#token').val();
        const submit = $('#submit').val();
        
        const form = new FormData();
        form.append('text[]', text);
        form.append('submit', submit);
        form.append('token', token);
        form.append('build_server', serverId);
        form.append('build_server_id', serverIdValue);

        const res = await axios.post(url, form, {
            headers: {
                ...form.getHeaders(),
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                'cookie': ''
            }
        });

        const $$ = cheerio.load(res.data);
        const form_value_input = $$('#form_value_input').val();
        const form_confirm = $$('#form_confirm').val();

        const res2 = await axios.post('https://en.ephoto360.com/effect/create-image', {
            id: form_confirm,
            value: form_value_input
        }, {
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
            },
            transformRequest: [(data) => {
                return Object.keys(data).map(key => `${key}=${encodeURIComponent(data[key])}`).join('&');
            }]
        });

        return {
            image: res2.data.full_image || res2.data.image
        };
    } catch (e) {
        console.error('[TEXTMAKER ERROR]', e.message);
        throw e;
    }
}

module.exports = { ephoto };
