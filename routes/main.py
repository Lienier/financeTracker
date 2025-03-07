from flask import Blueprint, render_template, redirect, url_for, request, jsonify
from flask_login import login_required, current_user
from models import db, Transaction, Budget
from datetime import datetime

main = Blueprint('main', __name__)

@main.route('/')
@login_required
def index():
    transactions = Transaction.query.filter_by(user_id=current_user.id).order_by(Transaction.date.desc()).limit(5).all()
    return render_template('index.html', transactions=transactions)

@main.route('/add_transaction', methods=['POST'])
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
        date=datetime.now(),
        user_id=current_user.id
    )
    
    db.session.add(transaction)
    db.session.commit()
    
    return redirect(url_for('main.index'))

@main.route('/get_summary')
@login_required
def get_summary():
    income = db.session.query(db.func.sum(Transaction.amount))\
        .filter_by(user_id=current_user.id, type='income').scalar() or 0
    
    expenses = db.session.query(db.func.sum(Transaction.amount))\
        .filter_by(user_id=current_user.id, type='expense').scalar() or 0
    
    return jsonify({
        'income': income,
        'expenses': expenses,
        'balance': income - expenses
    })

@main.route('/transactions')
@login_required
def transactions():
    transactions = Transaction.query.filter_by(user_id=current_user.id).order_by(Transaction.date.desc()).all()
    return render_template('transactions.html', transactions=transactions)

@main.route('/analytics')
@login_required
def analytics():
    # Get category totals for expenses
    expense_by_category = db.session.query(
        Transaction.category,
        db.func.sum(Transaction.amount).label('total')
    ).filter_by(
        user_id=current_user.id,
        type='expense'
    ).group_by(Transaction.category).all()
    
    return render_template('analytics.html', expense_by_category=expense_by_category)

@main.route('/budgets')
@login_required
def budgets():
    budgets = Budget.query.filter_by(user_id=current_user.id).all()
    
    # Calculate spending for each budget category
    spending_by_category = {}
    for budget in budgets:
        total = db.session.query(db.func.sum(Transaction.amount))\
            .filter_by(user_id=current_user.id, type='expense', category=budget.category)\
            .scalar() or 0
        spending_by_category[budget.category] = total
    
    return render_template('budgets.html', budgets=budgets, spending=spending_by_category)
