from app import create_app
from models import db, Budget

app = create_app()

with app.app_context():
    # Try to create a test budget
    try:
        test_budget = Budget(
            category='Test',
            amount=100.0,
            month=3,
            year=2025,
            user_id=1
        )
        print("Budget model attributes:", [column.name for column in Budget.__table__.columns])
        print("Test budget month:", test_budget.month)
        print("Test budget year:", test_budget.year)
    except Exception as e:
        print("Error:", str(e))
