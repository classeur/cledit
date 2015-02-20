var gulp = require('gulp');
var express = require('express');
var serveStatic = require('serve-static');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');

gulp.task('express', function() {
	var app = express();
	app.use(serveStatic(__dirname));
	var port = process.env.PORT || 11583;
	app.listen(port, null, function() {
		console.log('Server started: http://localhost:' + port);
	});
});

gulp.task('run', [
	'express'
]);

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
