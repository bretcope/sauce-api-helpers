#!/usr/bin/env node

const fetch = require('node-fetch');

async function main()
{
    let parentUser = '';
    let apiKey = '';
    let start = '';
    let end = '';

    for (let i = 2; i < process.argv.length; i++)
    {
        switch (process.argv[i])
        {
            case '-u':
            case '--user':
                parentUser = process.argv[i + 1];
                i++;
                break;
            case '-k':
            case '--key':
                apiKey = process.argv[i + 1];
                i++;
                break;
            case '-s':
            case '--start':
                start = process.argv[i + 1];
                i++;
                break;
            case '-e':
            case '--end':
                end = process.argv[i + 1];
                i++;
                break;
            default:
                throw new Error('Unknown argument: ' + process.argv[i]);
        }
    }

    if (!parentUser || !apiKey)
    {
        console.error('Must provide API user and key');
        process.exit(1);
    }

    const auth = encodeBasicAuth(parentUser, apiKey);
    const usernames = await getSubUsers(parentUser, auth);
    usernames.unshift(parentUser);

    const byUser = await getUsageByMonthByUser(usernames, auth, start, end);
    console.log(byUser);
}

/**
 * @returns {string}
 */
function encodeBasicAuth(user, apiKey)
{
    const format = user + ':' + apiKey;
    return 'Basic ' + Buffer.from(format).toString('base64');
}

function sleep(duration)
{
    return new Promise(resolve => setTimeout(resolve, duration));
}

async function getSubUsers(username, auth)
{
    const url = `https://saucelabs.com/rest/v1/users/${username}/list-subaccounts`;
    const headers = { Authorization: auth };
    const res = await fetch(url, { headers: headers });
    if (!res.ok)
    {
        console.error(res);
        throw new Error('API Error');
    }
    const json = await res.json();
    return json.users.map(u => u.username);
}

/**
 * @param username {string}
 * @param auth {string}
 * @param start {string}
 * @param end {string}
 */
async function requestUsageByDay(username, auth, start, end)
{
    const url = `https://saucelabs.com/rest/v1/users/${username}/usage`;

    let query = '';
    if (start)
        query += '?start=' + encodeURIComponent(start);

    if (end)
        query += (query ? '&' : '?') + 'end=' + encodeURIComponent(end);

    const headers = { Authorization: auth };
    const res = await fetch(url + query, { headers: headers });
    if (!res.ok)
    {
        console.error(res);
        throw new Error('API Error');
    }
    return res.json();
}

/**
 * @param username {string}
 * @param auth {string}
 * @param start {string}
 * @param end {string}
 */
async function getUsageByMonth(username, auth, start, end)
{
    console.log(`Getting data for user ${username}...`);
    const json = await requestUsageByDay(username, auth, start, end);

    let byMonth = {};
    for (const dayUsage of json.usage)
    {
        let date = new Date(dayUsage[0] + 'Z');
        date.setDate(1); // clamp to beginning of month
        const monthKey = date.toISOString().substr(0, "YYYY-MM".length);
        if (!byMonth[monthKey])
            byMonth[monthKey] = { jobs: 0, time: 0 };

        byMonth[monthKey].jobs += dayUsage[1][0];
        byMonth[monthKey].time += dayUsage[1][1];
    }

    return byMonth;
}

/**
 * @param usernames {string[]}
 * @param auth {string}
 * @param start {string}
 * @param end {string}
 * @returns {Promise<void>}
 */
async function getUsageByMonthByUser(usernames, auth, start, end)
{
    let wait = false;
    let byUser = {};
    for (const username of usernames)
    {
        if (wait)
            await sleep(100); // wait 100 milliseconds between API calls
        else
            wait = true;

        byUser[username] = await getUsageByMonth(username, auth, start, end);
    }

    return byUser;
}

main().catch(console.error);
