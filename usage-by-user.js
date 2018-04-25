#!/usr/bin/env node

const fetch = require('node-fetch');
const readline = require('readline');
const fs = require('fs');

async function main()
{
    const options = await getArguments();

    const auth = encodeBasicAuth(options.username, options.apiKey);
    const usernames = await getSubUsers(options.username, auth);
    usernames.unshift(options.username);

    const byUser = await getUsageByMonthByUser(usernames, auth, options.start, options.end);
    console.log(byUser);

    if (options.saveCsv)
        saveCsv(usernames, byUser);
}

async function getArguments()
{
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    try
    {
        const username = await new Promise(resolve => rl.question('Username:', resolve));
        if (!username)
            throw new Error('Must provide a username.');

        const apiKey = await new Promise(resolve => rl.question('API Access Key:', resolve));
        if (!apiKey)
            throw new Error('Must provide an API access key.');

        const start = await new Promise(resolve => rl.question('Start date (YYYY-MM-DD), or leave blank for default dates:', resolve));
        const end = await new Promise(resolve => rl.question('End date (YYYY-MM-DD), or leave blank for default dates:', resolve));

        const csvAnswer = await new Promise(resolve => rl.question(`Would you like to save ~/${username}.csv? (y/n):`, resolve));

        return {
            username: username,
            apiKey: apiKey,
            start: start,
            end: end,
            saveCsv: csvAnswer.toLowerCase() === 'y'
        };
    }
    finally
    {
        rl.close();
    }
}

function saveCsv(username, byUser)
{
    let csv = 'User,Year,Month,Jobs,Time (seconds)\n';

    for (const username of byUser.keys())
    {
        if (!byUser.hasOwnProperty(username))
            continue;

        const userData = byUser[username];
        for (const monthString of userData)
        {
            if (!userData.hasOwnProperty(monthString))
                continue;

            const year = monthString.substr(0, 4);
            const month = monthString.substr(5, 2);

            csv += `${username},${year},${month},${userData[monthString].jobs},${userData[monthString].time}\n`;
        }
    }

    const filename = `~/${username}.csv`;
    fs.writeFileSync(filename, csv);
    console.log('Wrote file ' + filename);
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
