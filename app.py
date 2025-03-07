from flask import Flask, render_template, redirect, url_for, flash, request, jsonify
from flask_login import LoginManager, login_user, login_required, logout_user, current_user
from datetime import datetime, timedelta
from models import db, User, Transaction, Budget
from sqlalchemy import func, extract
from sqlalchemy.exc import IntegrityError
from dateutil.relativedelta import relativedelta
import os
import calendar

# Initialize Flask-Login
login_manager = LoginManager()

def create_app():
    app = Flask(__name__)
    app.config['SECRET_KEY'] = 'dev-key-please-change'
    
    # Ensure instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass
        
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{os.path.join(app.instance_path, "finances.db")}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Initialize extensions with app
    db.init_app(app)
    login_manager.init_app(app)
    login_manager.login_view = 'login'

    with app.app_context():
        db.create_all()  # Create tables for all models

    @login_manager.user_loader
    def load_user(user_id):
        return User.query.get(int(user_id))

    # Routes
    @app.route('/')
    @login_required
    def index():
        transactions = Transaction.query.filter_by(user_id=current_user.id).order_by(Transaction.date.desc()).limit(5).all()
        return render_template('index.html', transactions=transactions)

    @app.route('/login', methods=['GET', 'POST'])
    def login():
        if request.method == 'POST':
            username = request.form.get('username')
            password = request.form.get('password')
            user = User.query.filter_by(username=username).first()
            
            if user and user.check_password(password):
                login_user(user)
                return redirect(url_for('index'))
            else:
                flash('Invalid username or password')
        return render_template('login.html')

    @app.route('/register', methods=['GET', 'POST'])
    def register():
        if request.method == 'POST':
            username = request.form.get('username')
            email = request.form.get('email')
            password = request.form.get('password')
            
            if User.query.filter_by(username=username).first():
                flash('Username already exists')
                return redirect(url_for('register'))
                
            if User.query.filter_by(email=email).first():
                flash('Email already registered')
                return redirect(url_for('register'))
                
            user = User(username=username, email=email)
            user.set_password(password)
            db.session.add(user)
            db.session.commit()
            
            login_user(user)
            return redirect(url_for('index'))
            
        return render_template('register.html')

    @app.route('/logout')
    @login_required
    def logout():
        logout_user()
        return redirect(url_for('login'))

    @app.route('/transactions')
    @login_required
    def transactions():
        page = request.args.get('page', 1, type=int)
        per_page = 10
        
        # Build query with filters
        query = Transaction.query.filter_by(user_id=current_user.id)
        
        # Apply filters if provided
        type_filter = request.args.get('type')
        if type_filter:
            query = query.filter_by(type=type_filter)
            
        category_filter = request.args.get('category')
        if category_filter:
            query = query.filter_by(category=category_filter)
            
        date_filter = request.args.get('date')
        if date_filter:
            date_obj = datetime.strptime(date_filter, '%Y-%m-%d')
            query = query.filter(
                Transaction.date >= date_obj,
                Transaction.date < date_obj + timedelta(days=1)
            )
        
        # Order by date descending and paginate
        transactions = query.order_by(Transaction.date.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        
        return render_template('transactions.html', transactions=transactions)

    @app.route('/add_transaction', methods=['POST'])
    @login_required
    def add_transaction():
        description = request.form.get('description')
        amount = float(request.form.get('amount'))
        category = request.form.get('category')
        type = request.form.get('type')
        
        transaction = Transaction(
            description=description,
            amount=amount,
            category=category,
            type=type,
            date=datetime.utcnow(),
            user_id=current_user.id
        )
        
        db.session.add(transaction)
        db.session.commit()
        
        return redirect(url_for('index'))

    @app.route('/edit_transaction/<int:id>', methods=['GET', 'POST'])
    @login_required
    def edit_transaction(id):
        transaction = Transaction.query.get_or_404(id)
        
        # Ensure user owns this transaction
        if transaction.user_id != current_user.id:
            flash('Unauthorized access')
            return redirect(url_for('transactions'))
        
        if request.method == 'POST':
            transaction.description = request.form.get('description')
            transaction.amount = float(request.form.get('amount'))
            transaction.category = request.form.get('category')
            transaction.type = request.form.get('type')
            
            db.session.commit()
            flash('Transaction updated successfully')
            return redirect(url_for('transactions'))
            
        return jsonify({
            'id': transaction.id,
            'description': transaction.description,
            'amount': transaction.amount,
            'category': transaction.category,
            'type': transaction.type
        })

    @app.route('/delete_transaction/<int:id>', methods=['POST'])
    @login_required
    def delete_transaction(id):
        transaction = Transaction.query.get_or_404(id)
        
        # Ensure user owns this transaction
        if transaction.user_id != current_user.id:
            flash('Unauthorized access')
            return redirect(url_for('transactions'))
        
        db.session.delete(transaction)
        db.session.commit()
        flash('Transaction deleted successfully')
        
        return redirect(url_for('transactions'))

    @app.route('/get_summary')
    @login_required
    def get_summary():
        income = db.session.query(func.sum(Transaction.amount))\
            .filter_by(user_id=current_user.id, type='income').scalar() or 0
        
        expenses = db.session.query(func.sum(Transaction.amount))\
            .filter_by(user_id=current_user.id, type='expense').scalar() or 0
        
        return jsonify({
            'income': round(income, 2),
            'expenses': round(expenses, 2),
            'balance': round(income - expenses, 2)
        })

    @app.route('/analytics')
    @login_required
    def analytics():
        # Get category-wise expenses
        category_expenses = db.session.query(
            Transaction.category,
            func.sum(Transaction.amount).label('total')
        ).filter_by(
            user_id=current_user.id,
            type='expense'
        ).group_by(Transaction.category).all()
        
        # Get monthly spending data for the last 6 months
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        monthly_data = db.session.query(
            func.strftime('%Y-%m', Transaction.date).label('month'),
            func.sum(Transaction.amount).label('total')
        ).filter(
            Transaction.user_id == current_user.id,
            Transaction.type == 'expense',
            Transaction.date >= six_months_ago
        ).group_by('month').order_by('month').all()
        
        # Format monthly data for better display
        formatted_monthly_data = []
        for month_str, total in monthly_data:
            year, month = map(int, month_str.split('-'))
            month_name = f"{calendar.month_name[month]} {year}"
            formatted_monthly_data.append((month_name, total))
        
        return render_template('analytics.html', 
                           category_expenses=category_expenses,
                           monthly_data=formatted_monthly_data)

    @app.route('/dashboard')
    @login_required
    def dashboard():
        return render_template('dashboard.html')

    @app.route('/get_category_expenses')
    @login_required
    def get_category_expenses():
        # Get expenses grouped by category
        expenses = db.session.query(
            Transaction.category,
            func.sum(Transaction.amount).label('total')
        ).filter_by(
            user_id=current_user.id,
            type='expense'
        ).group_by(Transaction.category).all()
        
        categories = [exp.category for exp in expenses]
        amounts = [float(exp.total) for exp in expenses]
        
        return jsonify({
            'categories': categories,
            'amounts': amounts
        })

    @app.route('/get_monthly_trends')
    @login_required
    def get_monthly_trends():
        # Get last 6 months of expenses
        six_months_ago = datetime.now() - timedelta(days=180)
        
        expenses = db.session.query(
            func.strftime('%Y-%m', Transaction.date).label('month'),
            func.sum(Transaction.amount).label('total')
        ).filter(
            Transaction.user_id == current_user.id,
            Transaction.type == 'expense',
            Transaction.date >= six_months_ago
        ).group_by('month').order_by('month').all()
        
        months = []
        amounts = []
        
        for expense in expenses:
            year, month = expense.month.split('-')
            month_name = calendar.month_name[int(month)]
            months.append(f"{month_name} {year}")
            amounts.append(float(expense.total))
        
        return jsonify({
            'months': months,
            'expenses': amounts
        })

    @app.route('/get_summary_data')
    @login_required
    def get_summary_data():
        try:
            # Get current month's transactions
            current_month = datetime.now().month
            current_year = datetime.now().year
            
            # Calculate total income
            total_income = db.session.query(func.sum(Transaction.amount))\
                .filter(Transaction.user_id == current_user.id,
                       Transaction.type == 'income',
                       extract('month', Transaction.date) == current_month,
                       extract('year', Transaction.date) == current_year)\
                .scalar() or 0.0
            
            # Calculate total expenses
            total_expenses = db.session.query(func.sum(Transaction.amount))\
                .filter(Transaction.user_id == current_user.id,
                       Transaction.type == 'expense',
                       extract('month', Transaction.date) == current_month,
                       extract('year', Transaction.date) == current_year)\
                .scalar() or 0.0
            
            # Calculate balance
            balance = total_income - total_expenses
            
            return jsonify({
                'total_income': float(total_income),
                'total_expenses': float(total_expenses),
                'balance': float(balance)
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/get_category_data/<transaction_type>')
    @login_required
    def get_category_data(transaction_type):
        try:
            # Get current month's transactions
            current_month = datetime.now().month
            current_year = datetime.now().year
            
            # Get category totals
            category_totals = db.session.query(
                Transaction.category,
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.user_id == current_user.id,
                Transaction.type == transaction_type,
                extract('month', Transaction.date) == current_month,
                extract('year', Transaction.date) == current_year
            ).group_by(Transaction.category).all()
            
            # Calculate total amount
            total_amount = sum(float(amount) for _, amount in category_totals)
            
            # Convert to dictionary with float values
            result = {category: float(amount) for category, amount in category_totals}
            result['_total'] = total_amount
            
            return jsonify(result)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/get_monthly_data/<transaction_type>')
    @login_required
    def get_monthly_data(transaction_type):
        try:
            # Get the last 6 months of data
            end_date = datetime.now()
            start_date = end_date - relativedelta(months=5)
            
            # Initialize data structure
            monthly_data = {}
            current_date = start_date
            while current_date <= end_date:
                monthly_data[current_date.strftime('%Y-%m')] = 0
                current_date += relativedelta(months=1)
            
            # Query transactions
            transactions = db.session.query(
                func.strftime('%Y-%m', Transaction.date).label('month'),
                func.sum(Transaction.amount).label('total')
            ).filter(
                Transaction.user_id == current_user.id,
                Transaction.type == transaction_type,
                Transaction.date >= start_date,
                Transaction.date <= end_date
            ).group_by('month').all()
            
            # Update monthly totals
            for month, total in transactions:
                if month in monthly_data:
                    monthly_data[month] = float(total)
            
            # Format labels for display
            labels = []
            values = []
            for month, total in monthly_data.items():
                year, month_num = month.split('-')
                month_name = datetime(int(year), int(month_num), 1).strftime('%B %Y')
                labels.append(month_name)
                values.append(total)
            
            return jsonify({
                'labels': labels,
                'values': values
            })
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    @app.route('/get_dashboard_budgets_data')
    @login_required
    def get_dashboard_budgets_data():
        current_month = datetime.now().month
        current_year = datetime.now().year

        # Get all budgets for current month
        budgets = Budget.query.filter_by(
            user_id=current_user.id,
            month=current_month,
            year=current_year
        ).all()

        # Calculate spent amount for each budget
        budget_data = []
        for budget in budgets:
            spent = db.session.query(func.sum(Transaction.amount)).filter(
                Transaction.user_id == current_user.id,
                Transaction.type == 'expense',
                Transaction.category == budget.category,
                extract('month', Transaction.date) == current_month,
                extract('year', Transaction.date) == current_year
            ).scalar() or 0.0

            budget_data.append({
                'id': budget.id,
                'category': budget.category,
                'amount': float(budget.amount),
                'spent': float(spent)
            })

        return jsonify({'budgets': budget_data})

    @app.route('/add_dashboard_budget', methods=['POST'])
    @login_required
    def add_dashboard_budget():
        data = request.get_json()
        
        try:
            # Parse month and year from the month input (format: YYYY-MM)
            month_str = data.get('month')
            if not month_str:
                return jsonify({'error': 'Month is required'}), 400
                
            year, month = map(int, month_str.split('-'))
            
            # Create new budget
            budget = Budget(
                user_id=current_user.id,
                category=data['category'],
                amount=float(data['amount']),
                month=month,
                year=year
            )
            
            db.session.add(budget)
            db.session.commit()
            
            return jsonify({'message': 'Budget added successfully'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 400

    @app.route('/delete_dashboard_budget/<int:budget_id>', methods=['POST'])
    @login_required
    def delete_dashboard_budget(budget_id):
        budget = Budget.query.get_or_404(budget_id)
        
        if budget.user_id != current_user.id:
            return jsonify({'error': 'Unauthorized'}), 403
            
        try:
            db.session.delete(budget)
            db.session.commit()
            return jsonify({'message': 'Budget deleted successfully'})
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': str(e)}), 400

    @app.route('/get_budgets')
    @login_required
    def get_budgets():
        try:
            # Get current month's budgets
            current_month = datetime.now().month
            current_year = datetime.now().year
            
            # Get all budgets for current month
            budgets = Budget.query.filter_by(
                user_id=current_user.id,
                month=current_month,
                year=current_year
            ).all()
            
            # Calculate spent amount for each budget
            budget_data = []
            for budget in budgets:
                # Get total spent in this category
                spent = db.session.query(func.sum(Transaction.amount))\
                    .filter(Transaction.user_id == current_user.id,
                           Transaction.type == 'expense',
                           Transaction.category == budget.category,
                           extract('month', Transaction.date) == current_month,
                           extract('year', Transaction.date) == current_year)\
                    .scalar() or 0.0
                
                budget_data.append({
                    'id': budget.id,
                    'category': budget.category,
                    'amount': float(budget.amount),
                    'spent': float(spent),
                    'month': budget.month,
                    'year': budget.year
                })
            
            return jsonify(budget_data)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True)
