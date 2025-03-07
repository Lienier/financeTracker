from app import create_app
from models import db, Budget
from sqlalchemy import inspect

app = create_app()

with app.app_context():
    # Get the table info
    inspector = inspect(db.engine)
    columns = inspector.get_columns('budget')
    print("Budget table columns:")
    for column in columns:
        print(f"- {column['name']}: {column['type']}")

    # Try to create a test budget
    try:
        test_budget = Budget(
            category='Test',
            amount=100.0,
            month=3,
            year=2025,
            user_id=1
        )
        db.session.add(test_budget)
        db.session.commit()
        
        # Query the budget back
        budget = db.session.query(Budget).filter_by(category='Test').first()
        print("\nSuccessfully created and retrieved test budget:")
        print(f"Category: {budget.category}")
        print(f"Amount: {budget.amount}")
        print(f"Month: {budget.month}")
        print(f"Year: {budget.year}")
        
        # Clean up
        db.session.delete(budget)
        db.session.commit()
    except Exception as e:
        print("\nError:", str(e))
