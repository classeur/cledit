var clgulp = require('clgulp')
var gulp = clgulp(require('gulp'))
var exec = clgulp.exec
var util = clgulp.util
var connect = require('gulp-connect')
var concat = require('gulp-concat')
var uglify = require('gulp-uglify')

gulp.task('tag', ['default', 'lint'], function (cb) {
  var version = require('./package.json').version
  var tag = 'v' + version
  util.log('Tagging as: ' + util.colors.cyan(tag))
  exec([
    'git add package.json dist',
    'git commit -m "Prepare release"',
    'git tag -a ' + tag + ' -m "Version ' + version + '"',
    'git push origin master --tags',
    'npm publish'
  ], cb)
})

gulp.task('connect', function () {
  connect.server({
    port: 8888
  })
})

var scripts = [
  'node_modules/clunderscore/clunderscore.js',
  'scripts/*.js'
]

gulp.task('build-js', function () {
  return gulp.src(scripts)
    .pipe(concat('cledit.js'))
    .pipe(gulp.dest('dist'))
})

gulp.task('build-js-min', function () {
  return gulp.src(scripts)
    .pipe(concat('cledit-min.js'))
    .pipe(uglify())
    .pipe(gulp.dest('dist'))
})

gulp.task('default', ['build-js', 'build-js-min'])
