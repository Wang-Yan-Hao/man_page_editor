#!/bin/sh

sudo find /usr/src/ -type f -regex '.*\.[0-9]$' > man_page_map.txt

input_file="man_page_map.txt"
output_file="../root/other/man_page_map.json"

echo "{" > "$output_file"
awk -F'/' '{ printf("\"%s\" : \"%s\",\n", $NF, $0) }' "$input_file" >> "$output_file"
sed '$ s/.$//' "$output_file" > "$output_file.tmp" && mv "$output_file.tmp" "$output_file"
grep -v ".git" "$output_file" > "$output_file.tmp" && mv "$output_file.tmp" "$output_file"
echo "}" >> "$output_file"