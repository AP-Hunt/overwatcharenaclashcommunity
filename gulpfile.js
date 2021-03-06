const { series, parallel, src, dest, pipe, watch } = require("gulp");
const sass = require("gulp-sass");
const rimraf = require("rimraf");
const pug = require("gulp-pug");
const webserver = require("gulp-webserver");
const fs = require("fs");
const path = require("path");
const rename = require("gulp-rename");
const twitter = require('twitter');
const process = require("process");
const { execFile } = require("child_process");
const { fillDataInteractive } = require("./fill_data_interactive");

const SOURCES = {
    scss: "src/scss/**/*.scss",
    js: "node_modules/tablesort/dist/**/*.js",
    pug: [
        "src/pug/**/*.pug",
        "!src/pug/**/_*",
    ],
    data: {
        currentSeason: "src/data/current/",
    },
    archives: "src/archives/**/*"
}

const DESTINATIONS = {
    css: "dist/css/",
    js: "dist/js/",
    html: {
        current: "dist/",
        archives: "dist/archives/"
    }
}

function buildCSS() {
    return src(SOURCES.scss)
        .pipe(sass().on("error", sass.logError))
        .pipe(dest(DESTINATIONS.css))
}

function buildHTML(done) {
    return series(buildCurrentSeason, copyArchivesToDist)(done);
}

function buildCurrentSeason(done) {
    let data = importData(SOURCES.data.currentSeason);
    return renderPug(data, DESTINATIONS.html.current);
}

function copyArchivesToDist() {
    return src(SOURCES.archives)
        .pipe(dest(DESTINATIONS.html.archives))
}


function importData(targetDir) {
    let data = {};
    let dirEntries = fs.readdirSync(targetDir);
    for (var f in dirEntries) {
        if (dirEntries.hasOwnProperty(f)) {
            let fileName = dirEntries[f];
            let filePath = path.join(targetDir, fileName);
            try 
            {
                var contents = JSON.parse(fs.readFileSync(filePath));
            }catch(e){
                console.error("Failed to parse JSON file: " + filePath)
                throw e;
            }
            data[fileName.split(".")[0]] = contents;
        }
    }

    return data;
}

function renderPug(data, destination) {
    return src(SOURCES.pug)
        .pipe(
            pug({
                data: data
            })
        )
        .pipe(dest(destination));
}

function buildJS(done) {
    return src(SOURCES.js)
        .pipe(dest(DESTINATIONS.js));
}

function clean(done) {
    rimraf("dist/", done);
}

function serve() {
    return src(DESTINATIONS.html.current)
        .pipe(webserver({
            livereload: true,
            open: true,
            host: "localhost",
            port: 9090,
            fallback: "index.html"
        }));
}

function watchFiles() {
    watch(SOURCES.data.currentSeason, buildHTML);
    watch(SOURCES.js, buildJS);
    watch(SOURCES.scss, buildCSS);
    watch(SOURCES.pug, buildHTML);
}

function tweet(done){
    var client = new twitter({
        consumer_key: process.env.TWITTER_CONSUMER_KEY,
        consumer_secret: process.env.TWITTER_CONSUMER_SECRET,
        access_token_key: process.env.TWITTER_ACCESS_TOKEN_KEY,
        access_token_secret: process.env.TWITTER_ACCESS_TOKEN_SECRET
      });

      var data = importData(SOURCES.data.currentSeason)
      var season = data["_meta"]["title"]
      var week = data ["groups"]["week"]

      var message = "Group tables for " + season + " week " + week + " are LIVE! Check them out at https://www.overwatcharenaclashcommunity.com/"

      client.post('statuses/update', {status: message},  function(error, tweet, response) {
        if(error) {
            console.error(error);
            throw error;
        }

        done();
      });
}

function fillData(done){
    return fillDataInteractive(done);
}

exports.default = series(clean, buildCSS, buildHTML, buildJS);
exports.buildCSS = buildCSS;
exports.buildJS = buildJS;
exports.buildHTML = buildHTML;
exports.serve = serve;
exports.watch = series(exports.default, serve, watchFiles);
exports.tweet = tweet;
exports.fillData = fillData;