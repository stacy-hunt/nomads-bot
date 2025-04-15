require('dotenv').config();

const { Client } = require('@notionhq/client');

const notionNomads = new Client({ auth: process.env.NOMADS_TOKEN });
const notionClient = new Client({ auth: process.env.MONDPLAN_TOKEN });

const context = {
	notionNomads,
	notionClient,
	sourceDbId: '1b198a8f-584e-80b6-9e01-e5d2ca4ac0a8',
	targetDbId: '1b15fe45-647b-80a4-99ec-e15d60953a2e',
};

module.exports = context;
