# FreeBSD online man page editor
An online man page editor for FreeBSD man page. Only front-end with HTML, CSS and JS in this editor. Using [Jroff](https://github.com/Wang-Yan-Hao/jroff) (I fork with extend to support mdoc) to render mdoc.

Online website location: [website](https://wang-yan-hao.github.io/man_page_editor/root/)

## Open in the local server
There are three ways to open the website on the local server that can help you develop. When you change the code, you can see the change on the local server immediately.

### 1. VSC extension
You can easily open a local server through the [liver-server](https://github.com/ritwickdey/vscode-live-server-plus-plus) extension.

### 2. Node.js
Use the npm package, "http-server" to open a local server.

```bash
$ npm install --global http-server
$ http-server /root [options]
```
Advanced usage of [http-server](https://www.npmjs.com/package/http-server).

### 3. FreeBSD
We will use apache24 to open the local server.

```
$ pkg install apache24 # install
$ vim /usr/local/etc/apache24/httpd.conf
```
Change the "ServerName" column to your ip and 80 port. The "DocumentRoot" and "Directory" tag also need to be set to the root directory.

Please refer [Apache document](https://httpd.apache.org/docs/2.4/configuring.html)

```
$ service apache24 configtest # See is there something wrong with the httpd.conf file
$ service apache24 start # start apache service
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License
[MIT](https://choosealicense.com/licenses/mit/)
