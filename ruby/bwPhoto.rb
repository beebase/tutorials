require 'RMagick'
include 'Magick'

unless ARGV[0]
	puts "\n\n\nYou need to specify a filename: bwPhoto.rb <filename>\n\n\n"
	exit
end

new_img = "bw_#{ARGV[0]}"
img = Image.read(ARGV[0]).first

img = img.quantsize(256, GRAYColorspace)

if File.exists?(new_img)
	puts "Could not write file. Image name already exists."
	exit
end

img.write(new_img)

