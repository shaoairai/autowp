import sys
import os

# Add backend directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from flask_cors import CORS

from config import Config
from utils.database import init_db
from routes import register_blueprints


def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    CORS(app, resources={r'/api/*': {'origins': '*'}})

    init_db(app)
    register_blueprints(app)

    @app.route('/api/health')
    def health():
        return {'status': 'ok'}

    @app.errorhandler(500)
    def internal_error(e):
        return {'error': '伺服器內部錯誤'}, 500

    @app.errorhandler(404)
    def not_found(e):
        return {'error': '找不到此資源'}, 404

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
