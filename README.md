# MimeCast Logs Data Processor

This project is designed to fetch and process logs from MimeCast using their API, storing relevant log data along with IP geolocation information into a database.

## Table of Contents

- [Getting Started](#getting-started)
- [Prerequisites](#prerequisites)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [How It Works](#how-it-works)
- [Using IP2Location](#using-ip2location)
- [Error Handling](#error-handling)
- [Logging](#logging)

## Getting Started

This project allows you to fetch and process logs from MimeCast, enrich them with geolocation data based on IP addresses, and store the enriched data in your database. It is intended to run as a cron job or similar scheduled task.

## Prerequisites

- Node.js
- npm or yarn
- MongoDB (or another compatible database)
- IP2Location BIN file for IP geolocation data

## Environment Variables

The application requires several environment variables to function correctly. These variables are used for authenticating with the MimeCast API and managing tokens.

Create a `.env` file in the root directory and set the following variables:

```ini
MIMECAST_BASE_URL=<MimeCast Base URL>
MIMECAST_URI=<MimeCast API URI>
MIMECAST_SECRET_KEY=<Your MimeCast Secret Key>
MIMECAST_ACCESS_KEY=<Your MimeCast Access Key>
MIMECAST_APPLICATION_KEY=<Your MimeCast Application Key>
MIMECAST_APPLICATION_ID=<Your MimeCast Application ID>
