from app import create_app
from models import db

app = create_app()

with app.app_context():
    # Drop all existing tables
    db.drop_all()
    # Create all tables with updated schema
    db.create_all()
    print("Database tables recreated successfully!")
