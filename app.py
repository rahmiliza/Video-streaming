import logging

from flask import Flask, render_template, Response, request, url_for

logging.basicConfig()

app = Flask(__name__)
app.config['SECRET_KEY'] = ''
app.config['DEBUG'] = False

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    app.run()