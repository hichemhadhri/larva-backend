from colorthief import ColorThief
import sys 

color_thief = ColorThief('/Users/hichemhadhri/larva_backend/uploads/2021-08-25T17:49:20.572Zimage_picker_4519F092-A146-400C-9840-FECABA86034A.jpg')
# get the dominant color
dominant_color = color_thief.get_color(quality=1)

print(dominant_color)