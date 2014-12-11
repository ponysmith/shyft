module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),      
        uglify: {
            my_target: {
                files: {
                    'js/shyft.min.js': ['js/shyft.js']
                }
            }
        },
        cssmin: {
            add_banner: {
                options: {
                    banner: '/* shyft.js | https://github.com/ponysmith/shyft */'
                },
                files: {
                    'css/shyft.min.css': ['css/**/*.css']
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-cssmin');

    grunt.registerTask('default', ['uglify', 'cssmin']);

}
