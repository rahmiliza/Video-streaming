import logging

from flask import Flask, render_template, Response, request, url_for

logging.basicConfig()

app = Flask(__name__)
app.config['SECRET_KEY'] = '\xcd\xe9\xd9\x18\x96A=\xa2\xf7-\xfb\n\xb3\xd3\xb4Uk>8I\x9b\xc4}\xd0'
app.config['DEBUG'] = False

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)