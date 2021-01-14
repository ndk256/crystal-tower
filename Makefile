#makefile for Project 2 (game engine)

user = kelleher1

all:  PutHTML


PutHTML:
	cp glasstower.html /var/www/html/class/softdev/$(user)/project2/
	cp game.css /var/www/html/class/softdev/$(user)/project2/
	cp gameengine.js /var/www/html/class/softdev/$(user)/project2/
	cp glasstower.xml /var/www/html/class/softdev/$(user)/project2/
	cp favicon.ico /var/www/html/class/softdev/$(user)/project2/
	cp favicon-2.ico /var/www/html/class/softdev/$(user)/project2/
	echo "Current contents of your HTML directory: "
	ls -l /var/www/html/class/softdev/$(user)/project2/
