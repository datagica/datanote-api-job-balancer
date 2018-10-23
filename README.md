# Datanote API job balancer

Job control server for the Datanote API.

## Architecture

### TLDR

The job control server is in charge of collecting user requests, transform
them into jobs, and serve jobs to job runner instances. The user requests stay on
hold using Promises.

The job runner instances process the requests, then submit the results back to the
master which finalizes the pending request promises.

### Key components

There are four key components in the API:

#### datanote-api-job-balancer

The single entry point to the API connecting user requests with runner instances.
The current implementation is designed to have only one instance of the balancer
running, as all the data is stored in the memory of the instance, a few Kb (up
to a few Mb for large books).

In the future if we want to scale to multiple balancers we will need to store data
in a shared database such as Redis, or use an intermediary between the api and
workers, like a message queue.

#### datanote-api-job-runner

A job runner instance that connects to the balancer using websockets, to get jobs
to do in the background. Sends the results back to the balancer server once
completed.

#### datanote-api-engine

The heart of Datanote, a big bundle of all modules and datasets used to analyze
documents. It also exposes a toolkit of utility functions. Used by the workers.

#### datanote-api-client

Client library used to perform requests on the Datanote API using websockets.
This is the module used by the Datanote desktop app.

## Deployment

The Datanote API is currently hosted on `Now.sh` on a Pro account.

### Deployment of the job balancer

```bash
cd datanote-api-job-balancer
npm run deploy
now alias <NEW_INSTANCE> beta-api.datanote.io
now scale beta-api.datanote.io 1
```

Note: for the moment, there can be only one instance running on the beta-api

### Deployment of the job runners

```bash
cd datanote-api-job-runner
npm run deploy
```

At this point, you have to understand that shuting down old workers will stop
any pending query on it, which is not good for the quality of service.

The simple solution to this is to increment the version of workers and send it
to the master. The master will only give jobs to workers of version >= current.

So, wait for a few minutes, then you can finally scale the new version:

```bash
now alias <NEW_INSTANCE> beta-api-worker.datanote.io
```

(this will kill all old instances except for one, which will be frozen a bit
later automatically)

### Scaling the API

For the moment we have to keep a single master instance, but we can scale the
number of workers this way:

```bash
now scale beta-api-worker.datanote.io <SIZE>
```

For testing, it is best to use a size like 3.
For heavy loads, we could use something like 10 or 20.


## TODO

- support multiple formats:
  - datanote: a custom, low-level format supported by Datanote
  - json: basic list of entities
  - gexf: GEXF graph
  - csv: CSV graph (for Neo4J)  https://neo4j.com/developer/guide-import-csv/

## List of features

### Domains

The following domains are recognized by the API, but you can also define your own
(see the `Custom fields` paragraph).

detective:
- address
- email
- event
- evidence
- family
- phone
- position
- protagonist
- weapon

lifesciences:
- muscle
- animal
- artery
- bacteria
- cell
- disease
- drug
- healthRisk
- institution
- nerve
- protagonist
- location
- protein
- symptom
- virus

marketing:
- businessEvent
- institution
- position
- protagonist
- social
- product

engineer:
- engineeringElement
- engineeringEvent
- healthRisk
- institution
- protagonist

workplace:
- address
- diploma
- email
- family
- institution
- interest
- language
- phone
- position
- protagonist
- skill
- social
-
fiction:
- character
- location
- weapon
- event
- evidence

arts:
- email
- phone
- address
- compensation
- protagonist
- artist
- interest

generic:
- businessEvent
- engineeringEvent
- intelligenceEvent
- protagonist
- location

### Custom fields

Optional url parameters:

- locale: `en`, `fr` (example: `?locale=en`, `&locale=fr`..)
- fields: values to keep (example: `fields=id,label`, `&fields=label,links,target`..)
- domain: `PoliceReport`, see source for more (example: `?domain=PoliceReport`..)
- types: `bacteria`, `address`, `event`, see source for more
- - format: `graphson`, `gdf`, `gexf` (example: `?format=gdf`..)

Note: since `domain` cannot be used at the same time as `types`, `types` will
have priority and `domain` will have no effect.

### Domains and entity types

Current extraction model (you can change this, if your edit `engine.js`):

```javascript
{
  PoliceReport: [
    'email',
    'phone',
    'location',
    'evidence',
    'event',
    'protagonist',
    'position',
    'weapon',
  ],
  generic: [
    'protagonist',
  ]
}
```

## Legacy REST API Usage

Examples use [httpie](https://github.com/jakubroztocil/httpie) with [jq](https://github.com/stedolan/jq), but you can also use curl or something else.

The content-type is optional, it can help the app if there is an encoding
issue with magic number.

### Example with curl

```bash
curl -X POST "http://localhost:3000?locale=en&types=animal&format=gdf" -d "THE HIPPO KILLS THE DOLPHIN"
curl -X POST "http://localhost:3000?locale=en&types=protagonist,weapon&format=gdf" -d "James bond buys an ak-47"
curl -X POST "http://localhost:3000" --data-binary "@tests/fixtures/police_en.txt"
curl -X POST "http://localhost:3000?locale=en&types=protagonist,virus" -d "James Bond has caught the terrorist carrying H5N1"
```

### Example with httpie and jq

```bash
https POST "http://localhost:3000?locale=en&types=virus" body="the monkey died of ebola" | jq
https POST "http://localhost:3000" body="James Bond" | jq
https POST "http://localhost:3000" body="James Bond" | jq
https POST "http://localhost:3000?&fields=label,links,link,target&locale=en" body="James Bond"  | jq
https POST "http://localhost:3000?locale=en" body="James Bond"  | jq
https POST "http://localhost:3000?&fields=label,links,link,target" body="James Bond"  | jq
https POST "http://localhost:3000?locale=en&types=protagonist,virus" body="James Bond has caught the terrorist carrying H5N1" | jq
```

### Longer example

```bash
https POST "http://localhost:3000?fields=link,links,target,properties,ngram,begin,end,label,gender,number,firstname,lastname&locale=en" body="James Bond buys an AK-47"
```

output:
```json
{
  "type": "record",
  "label": {},
  "properties": {},
  "links": [
    {
      "link": {
        "type": "link",
        "label": "Mentions"
      },
      "properties": {
        "ngram": "James Bond",
        "begin": 0,
        "end": 10
      },
      "target": {
        "properties": {
          "firstname": "james",
          "lastname": "bond",
          "gender": [
            "m"
          ]
        },
        "links": [
          {
            "link": {
              "type": "link",
              "label": "Type"
            },
            "properties": {},
            "target": {
              "type": "entity",
              "label": "Protagonist"
            }
          },
          {
            "link": {
              "type": "purchase",
              "label": "Purchase"
            },
            "properties": {},
            "target": {
              "properties": {
                "number": "singular",
                "gender": "neutral"
              },
              "links": [
                {
                  "link": {
                    "type": "link",
                    "label": "Type"
                  },
                  "properties": {},
                  "target": {
                    "type": "entity",
                    "label": "Generic"
                  }
                }
              ],
              "label": "AK-47",
              "type": "entity"
            }
          }
        ],
        "label": "James BOND",
        "type": "entity"
      }
    },
    {
      "link": {
        "type": "link",
        "label": "Mentions"
      },
      "properties": {
        "begin": 19,
        "end": 24,
        "ngram": "AK-47"
      },
      "target": {
        "properties": {
          "number": "singular",
          "gender": "neutral"
        },
        "links": [
          {
            "link": {
              "type": "link",
              "label": "Type"
            },
            "properties": {},
            "target": {
              "type": "entity",
              "label": "Generic"
            }
          }
        ],
        "label": "AK-47",
        "type": "entity"
      }
    }
  ]
}```

### Medical example

```bash
https POST "http://localhost:3000?locale=en&types=virus" body="H5N1" | jq
```

```json
{
  "type": "record",
  "id": "record:undefined__undefined",
  "date": "2017-07-11T22:27:51.438Z",
  "label": {},
  "indexed": "H5N1",
  "properties": {},
  "links": [
    {
      "link": {
        "type": "link",
        "id": "link:mention",
        "label": "Mentions",
        "description": "Mention in a document",
        "aliases": [
          "mentioned in",
          "has a mention",
          "is mentioned",
          "are mentioned"
        ]
      },
      "properties": {
        "ngram": "H5N1",
        "score": 1,
        "sentence": 1,
        "word": 0,
        "begin": 0,
        "end": 4
      },
      "target": {
        "properties": {
          "category": "species"
        },
        "links": [
          {
            "link": {
              "type": "link",
              "id": "link:instanceof",
              "label": "Type",
              "plural": "Types",
              "description": "Of type",
              "aliases": [
                "of type"
              ]
            },
            "properties": {},
            "target": {
              "type": "entity",
              "id": "entity:virus",
              "label": "Virus",
              "plural": "Viruses",
              "description": "Virus",
              "aliases": [
                "virus",
                "viruses"
              ]
            }
          }
        ],
        "id": "entity:virus__influenza-a-virus-h5n1",
        "label": "Influenza A (H5N1)",
        "description": "Influenza A virus (subtype H5N1)",
        "aliases": [
          "H5N1",
          "H5N1 flu",
          "Influenza A H5N1",
          "Influenza A (H5N1)",
          "Influenza A subtype H5N1",
          "Influenza A (subtype H5N1)",
          "Influenza A (H5N1 subtype)"
        ],
        "type": "entity"
      }
    }
  ]
}
```

### GDF

```bash
curl -X POST "http://localhost:3000?locale=en&types=animal,virus&format=gdf" -d "the monkey has ebola"
```

```csv
nodedef>id VARCHAR,label VARCHAR
entity:animal__monkey,Monkey
entity:virus__ebolavirus,Ebolavirus
edgedef>id VARCHAR,source VARCHAR,target VARCHAR
```

### Graphson

```bash
curl -X POST "http://localhost:3000?locale=en&types=animal,virus&format=graphson" -d "the monkey has ebola"
```

```json
{
  "graph": {
    "mode": "NORMAL",
    "vertices": [
      {
        "_id": "entity:animal__monkey",
        "name": "Monkey",
        "_type": "vertex"
      },
      {
        "_id": "entity:virus__ebolavirus",
        "name": "Ebola",
        "_type": "vertex"
      }
    ],
    "edges": []
  }
}
```
