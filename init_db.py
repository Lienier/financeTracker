from app import create_app
from models import db

app = create_app()

with app.app_context():
    # Drop all tables first
    db.drop_all()
    # Create all tables fresh
    db.create_all()
    print("Database initialized successfully!")
