const API_USER = 'USERNAME';
const API_KEY = 'ACCESS_KEY';

// list usernames, one per line
const USERS = `
user1
user2
user3
`;

// YYYY-DD-MM
const START = '2018-01-01';
const END = '2018-01-31';

// =====================================================================================================================

const fetch = require('node-fetch');

/**
 * @returns {string}
 */
function encodeBasicAuth()
{
    const format = API_USER + ':' + API_KEY;
    return 'Basic ' + Buffer.from(format).toString('base64');
}

/**
 * @returns {string[]}
 */
function getUserList()
{
    return USERS.split(/\r?\n/g).map(u => u ? u.trim() : '').filter(u => u !== '');
}

const USER_LIST = getUserList();
const AUTH = encodeBasicAuth();

console.log(USER_LIST);
console.log(AUTH);

function sleep(duration)
{
    return new Promise(resolve => setTimeout(resolve, duration));
}

/**
 * @param username {string}
 * @param start {string}
 * @param end {string}
 */
async function requestUsageByDay(username, start, end)
{
    const url = `https://saucelabs.com/rest/v1/users/${username}/usage`;
    const headers = { Authorization: AUTH };
    const res = await fetch(url, headers);
    return res.json();
}

/**
 * @param username {string}
 * @param start {string}
 * @param end {string}
 */
async function getUsageByMonth(username, start, end)
{
    console.log(`Getting data for user ${username}...`);
    const json = await requestUsageByDay(username, start, end);

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

async function getUsageByMonthByUser(start, end)
{
    let wait = false;
    let byUser = {};
    for (const username of USER_LIST)
    {
        if (wait)
            await sleep(100); // wait 100 milliseconds between API calls
        else
            wait = true;

        byUser[username] = await getUsageByMonth(username, start, end);
    }

    return byUser;
}

getUsageByMonthByUser(START, END)
    .then(byUser => console.log(byUser))
    .catch(err => console.error(err));


