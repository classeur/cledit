var gulp = require('gulp');
var express = require('express');
var serveStatic = require('serve-static');

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

gulp.task('default', []);
