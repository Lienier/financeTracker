from app import create_app
from models import db, User, Transaction, Budget

def reset_database():
    app = create_app()
    with app.app_context():
        # Drop all tables
        db.drop_all()
        print("Dropped all tables.")
        
        # Create all tables
        db.create_all()
        print("Created all tables.")
        
        print("Database reset complete!")

if __name__ == '__main__':
    reset_database()
