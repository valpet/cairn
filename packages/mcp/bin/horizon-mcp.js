#!/usr/bin/env node

const path = require('path');
const { HorizonMCPServer } = require(path.join(__dirname, '..', 'dist', 'index.js'));

const server = new HorizonMCPServer();
server.start().catch(console.error);