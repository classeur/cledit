var gulp = require('gulp');
var connect = require('gulp-connect');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

gulp.task('connect', function() {
    connect.server({
        port: 8888
    });
});

gulp.task('build-js', function() {
    gulp.src('scripts/*.js')
        .pipe(concat('cledit.js'))
        .pipe(gulp.dest('dist'));
});

gulp.task('build-js-min', function() {
    gulp.src('scripts/*.js')
        .pipe(concat('cledit-min.js'))
        .pipe(uglify())
        .pipe(gulp.dest('dist'));
});

gulp.task('default', ['build-js', 'build-js-min']);
