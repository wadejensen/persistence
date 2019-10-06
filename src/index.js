const express = require('express');
const responseTime = require('response-time');
const fetch = require('node-fetch');
const redis = require("async-redis");

const AWS = require('aws-sdk');
const nodeCleanup = require('node-cleanup');

const {promisify} = require('util');

const bucketName = 'wjensen-wikipedia-store';
// Create a promise on S3 service object
const bucketPromise = new AWS.S3({apiVersion: '2006-03-01'})
    .createBucket({
        Bucket: bucketName,
        CreateBucketConfiguration: {
            LocationConstraint: "ap-southeast-2"
        }
    })
    .promise()
    .then( resp => {
        if (resp.statusCode == 200) {
            console.log(`${data} Successfully created s3 bucket: + ${bucketName}`)
        } else {
            console.error(`Unexpected response code: ${resp.statusCode}. ${resp}.`);
            process.exit(1);
        }
    })
    .catch(function(err) {
        if (err.statusCode == 409) {
            console.log(`Bucket ${bucketName} already exists.`)
        } else {
            console.error(err, err.stack);
            process.exit(1);
        }
    });

const app = express();

const redisClient = redis.createClient();
redisClient.on('error', (err) => {
    console.log("Error " + err);
    process.exit(1);
});

const s3Client = new AWS.S3({apiVersion: '2006-03-01'});

app.use(responseTime());

app.get('/api/search', async (req, res) => {
    const query = (req.query.query).trim();

    const redisKey = `wikipedia:${query}`;
    const s3Key = `wikipedia-${query}`;
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=parse&format=json&section=0&page=${query}`;

    let result;
    let source;

    console.log(!result);
    console.log(1);
    if (!result) {
        console.log(2);
        source = "Redis cache";
        result = await getFromRedis(redisClient, redisKey);
        console.log(result);
    }
    console.log(6);
    if (!result) {
        console.log(7);
        source = "S3 cache";
        result = await getFromS3(s3Client, bucketName, s3Key);
        console.log(8);
    }
    if (!result) {
        console.log(9);
        source = "Wikipedia";
        result = await getFromWikipedia(searchUrl);
        // cache for future lookups
        if (result) {
            console.log(10);
            writeToRedis(redisClient, redisKey, result);
            writeToS3(s3Client, bucketName, s3Key, result);
            console.log(11);
        }
    }
    if (result) {
        console.log(12);
        res.status(200).json(result);
        console.log(`Successfully served Wikipedia query: ${query} from ${source}`)
    } else {
        console.log(13);
        res.status(500).send(`Could not retrieve query: ${query} from Wikipedia.`)
    }
});

function getFromRedis(redisClient, key) {
    console.log(3);
    return redisClient
        .get(key)
        .then(result => {
            if (result === null) {
                console.info(`Could not find key: ${key} in Redis cache.`);
                return undefined;
            } else {
                return JSON.parse(result);
            }
        })
        .catch(err => {
            console.error(err, err.stack);
            return undefined;
        });
}

function writeToRedis(redisClient, key, json) {
    redisClient.setex(key, 3600, JSON.stringify({
        ...json,
        source: 'Redis Cache',
    }));
}

function getFromS3(s3Client, bucket, key) {
    const params = { Bucket: bucket, Key: key};
    return s3Client
        .getObject(params)
        .promise()
        .then(result => JSON.parse(result.Body))
        .catch(err => {
            console.error(`Could not read from S3: ${err.message}`);
            return undefined;
        });
}

function writeToS3(s3Client, bucket, key, json) {
    const objectParams = {
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify({
            ...json,
            source: 'S3 Cache',
        })
    };
    return s3Client
        .putObject(objectParams)
        .promise()
        .then(function(data) {
            console.log("Successfully uploaded data to " + bucket + "/" + key);
        })
        .catch(function(err) {
            console.log("Failed to write to S3");
            console.error(err, err.stack);
        });
}

function getFromWikipedia(searchUrl) {
    return fetch(searchUrl)
        .then(resp => resp.json())
        .then(json => {
            return { ...json, source: 'Wikipedia API' }
        })
        .catch(err => {
            console.error(err, err.stack);
            return undefined;
        });
}

app.listen(3000, () => {
    console.log('Server listening on port: ', 3000);
});


nodeCleanup(function (exitCode, signal) {
    console.log(`
    exitCode=${exitCode}, signal=${signal}
    Node is going to sleep... Now!`
    )
});
