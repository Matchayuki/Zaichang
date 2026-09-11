const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const files=['index.html','style.css','core.js','app.js','mark.svg','friendship.png'];
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
for(const f of files){if(!fs.statSync(path.join(__dirname,f)).size)throw Error('Empty asset '+f);if(f.endsWith('.js'))new vm.Script(fs.readFileSync(path.join(__dirname,f),'utf8'));if(f!=='index.html'&&!html.includes('"'+f+'"'))throw Error('Missing asset link '+f);}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML id');for(const m of fs.readFileSync(path.join(__dirname,'app.js'),'utf8').matchAll(/\$\('([^']+)'\)/g))if(!ids.includes(m[1]))throw Error('Missing element '+m[1]);
fs.mkdirSync(path.join(__dirname,'dist'),{recursive:true});for(const f of files)fs.copyFileSync(path.join(__dirname,f),path.join(__dirname,'dist',f));console.log('Zaichang: 6 local assets built; JavaScript syntax and DOM references checked.');
