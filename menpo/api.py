from flask import Flask

app = Flask(__name__)

@app.route('/')
def base():
    return 'hello'

def parse_port():
    port = 5001
    try:
        port = int(sys.argv[1])
    except Exception as e:
        pass
    return '{}'.format(port)

def main():
    app.run(host='127.0.0.1', port=parse_port())

if __name__ == '__main__':
    main()
