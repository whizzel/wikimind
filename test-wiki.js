const topic = "Transformer architecture";
const encoded = encodeURIComponent(topic.replace(/ /g, "_"));
const headers = { 
    Accept: "application/json",
    "User-Agent": "WikiMind/1.0 (https://github.com/whizzel/wikimind)"
};
const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;

fetch(url, { headers })
  .then(res => {
      console.log("Summary status:", res.status);
      return res.text();
  })
  .then(text => console.log("Summary body start:", text.slice(0, 100)))
  .catch(err => console.error(err));

const fullUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=extracts&explaintext=true&format=json&origin=*`;
fetch(fullUrl, { headers })
  .then(res => {
      console.log("Full status:", res.status);
      return res.text();
  })
  .then(text => console.log("Full body start:", text.slice(0, 100)))
  .catch(err => console.error(err));
