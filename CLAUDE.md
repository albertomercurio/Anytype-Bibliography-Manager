## Instructions from Anytype APIs

### Space creation

```
curl -L 'http://127.0.0.1:31009/v1/spaces' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer <token>' \
-d '{
  "description": "The local-first wiki",
  "name": "New Space"
}'
```

### List spaces

```
curl -L 'http://127.0.0.1:31009/v1/spaces' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer <token>'
```

### Type creation

For a Person
```
curl -L 'http://127.0.0.1:31009/v1/spaces/space_id/types' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Anytype-Version: 2025-05-20' \
-H 'Authorization: Bearer <token>' \
-d '{
    "icon": {
        "emoji": "📄",
        "format": "emoji"
    },
    "key": "human",
    "layout": "basic",
    "name": "Person",
    "plural_name": "People",
    "properties": [
    {
        "format": "text",
        "key": "first_name",
        "name": "First name"
    },
    {
        "format": "text",
        "key": "last_name",
        "name": "Last name"
    },
    {
        "format": "text",
        "key": "orcid",
        "name": "ORCID"
    }
  ]
}'
```

For a Journal
```
curl -L 'http://127.0.0.1:31009/v1/spaces/space_id/types' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Anytype-Version: 2025-05-20' \
-H 'Authorization: Bearer <token>' \
-d '{
  "icon": {
    "emoji": "📄",
    "format": "emoji"
  },
  "key": "journal",
  "layout": "basic",
  "name": "Journal",
  "plural_name": "Journals",
}'
```

The Article should include the following properties:
- title (text)
- authors (relation to Person)
- journal (relation to Journal)
- year (number)
- bibtex (text)
- doi (text)
- url (URL)

### List types in a space

```
curl -L 'http://127.0.0.1:31009/v1/spaces/:space_id/types' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer <token>'
```

### Search objects

```
curl -L 'http://127.0.0.1:31009/v1/spaces/:space_id/search?limit=100&offset=0' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer <token>' \
-d '{
  "query": "test",
  "sort": {
    "direction": "desc",
    "property_key": "last_modified_date"
  },
  "types": [
    "page",
    "task",
    "bookmark"
  ]
}'
```

For example, if I want to search all Articles, with no query, I would do:

```
curl -L 'http://127.0.0.1:31009/v1/spaces/:space_id/search?limit=100&offset=0' \
-H 'Content-Type: application/json' \
-H 'Accept: application/json' \
-H 'Authorization: Bearer <token>' \
-d '{
  "sort": {
    "direction": "desc",
    "property_key": "last_modified_date"
  },
  "types": [
    "article",
  ]
}'
```

### Common practices

When searching for objects, types or spaces, it is better to always use pagination (limit and offset) to avoid fetching too many results at once. Also, check that the `has_more` field in the response is `false` to know if there are more results to fetch.

When creating objects, it is a good practice to check if an object with the same unique property (e.g., DOI for articles) already exists in the space before creating a new one. This can be done by searching for the object using the unique property value.

When not sure, you can always navigate and read the documentation at https://developers.anytype.io/docs/reference.

### Example of the structure of a type

When I get the Article type, this is the structure

```
{
    "object": "type",
    "id": "bafyreic6dye5yim2yuwyemghaxx3w444div2ezmwzp6y3t6zfxi2efq7ta",
    "key": "reference",
    "name": "Article",
    "plural_name": "Articles",
    "icon": {
        "format": "icon",
        "name": "book",
        "color": "ice"
    },
    "archived": false,
    "layout": "basic",
    "properties": [
        {
            "object": "property",
            "id": "bafyreiaopjgv73ljpdcqjqvktt6cqurornuwrobqevqygoplhtdmqwfg2q",
            "key": "authors",
            "name": "Authors",
            "format": "objects"
        },
        {
            "object": "property",
            "id": "bafyreiaosyyfdc2gxkcicokz6jqh3lm35awztlj5lfpl2gzhfe7vbcpobi",
            "key": "year",
            "name": "Year",
            "format": "number"
        },
        {
            "object": "property",
            "id": "bafyreibpyd3gjjxa3t4vknc44ouyotooxvqfo27ltjuhbbo3erlqq5i55u",
            "key": "journal",
            "name": "Journal",
            "format": "objects"
        },
        {
            "object": "property",
            "id": "bafyreiemq2tz2iadqebhkhwfqlch3gt4qugiymx2fnvxvhkbxpnbuwkxde",
            "key": "url",
            "name": "URL",
            "format": "url"
        },
        {
            "object": "property",
            "id": "bafyreicnc37q45png2qcxi4h67dp5jonn7jzi22dye3yfhp5l2wew5vh5i",
            "key": "doi",
            "name": "DOI",
            "format": "text"
        },
        {
            "object": "property",
            "id": "bafyreiay3iunzeisv3zetjstcpnm3thmtatdu3xecij6pvz7x5kox44kti",
            "key": "pd_fs",
            "name": "PDFs",
            "format": "files"
        },
        {
            "object": "property",
            "id": "bafyreihjuje6tz22gsbdl2olr6w4qt7z6ddkoxlbdhc6bif6ppwvxs5vye",
            "key": "read",
            "name": "Read",
            "format": "checkbox"
        },
        {
            "object": "property",
            "id": "bafyreidkjmgx4i4w5vgdq2ytndndggddyzavreguzbmzngsi576x4i2iva",
            "key": "tag",
            "name": "Tag",
            "format": "multi_select"
        },
        {
            "object": "property",
            "id": "bafyreic6ctlzxrf6k6fsck3opbrsnvco4aauc752kurfz3zn3h6vmuiqbq",
            "key": "backlinks",
            "name": "Backlinks",
            "format": "objects"
        },
        {
            "object": "property",
            "id": "bafyreifzwzru4hsu264o7ey34klmh6wux3wjwzutpdvdknefxxjxfuhdp4",
            "key": "title",
            "name": "Title",
            "format": "text"
        },
        {
            "object": "property",
            "id": "bafyreidxpvw4wljzik2eg5ndbszaum3icfdyqywyax23q4wfxriyppvpum",
            "key": "bib_te_x",
            "name": "BibTeX",
            "format": "text"
        },
        {
            "object": "property",
            "id": "bafyreia3sfpvnq52qkhpkdyycvqmburedag3yb7nuhraz2x3up5iez4knm",
            "key": "created_date",
            "name": "Creation date",
            "format": "date"
        },
        {
            "object": "property",
            "id": "bafyreicnhf4z3sffjsoke6eh6vajq2hupsyrsgopa4n7ndf5k2zmzhlije",
            "key": "creator",
            "name": "Created by",
            "format": "objects"
        },
        {
            "object": "property",
            "id": "bafyreibckmlo5xjyfjzeoeo4r2okovcw7ik6o6yorbzgxvnsbtnewhboea",
            "key": "links",
            "name": "Links",
            "format": "objects"
        }
    ]
}
```

take this as a reference for creating objects and accessing properties.
