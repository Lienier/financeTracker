from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from datetime import datetime
from models import db, Transaction
from sqlalchemy import func

main = Blueprint('main', __name__)

@main.route('/')
@login_required
def index():
    return render_template('index.html')

@main.route('/transactions')
@login_required
def transactions():
    transactions = Transaction.query.filter_by(user_id=current_user.id).order_by(Transaction.date.desc()).all()
    return render_template('transactions.html', transactions=transactions)

@main.route('/api/transactions')
@login_required
def get_transactions():
    type_filter = request.args.get('type')
    category_filter = request.args.get('category')
    date_filter = request.args.get('date')
    
    query = Transaction.query.filter_by(user_id=current_user.id)
    
    if type_filter:
        query = query.filter_by(type=type_filter)
    if category_filter:
        query = query.filter_by(category=category_filter)
    if date_filter:
        date_obj = datetime.strptime(date_filter, '%Y-%m-%d')
        query = query.filter(func.date(Transaction.date) == date_obj.date())
    
    transactions = query.order_by(Transaction.date.desc()).all()
    return jsonify([{
        'id': t.id,
        'description': t.description,
        'amount': float(t.amount),
        'type': t.type,
        'category': t.category,
        'date': t.date.strftime('%Y-%m-%d')
    } for t in transactions])

@main.route('/add_transaction', methods=['POST'])
@login_required
def add_transaction():
    try:
        description = request.form.get('description')
        amount = float(request.form.get('amount'))
        category = request.form.get('category')
        type_ = request.form.get('type')
        date_str = request.form.get('date')
        
        if not all([description, amount, category, type_, date_str]):
            return jsonify({'error': 'All fields are required'}), 400
        
        date = datetime.strptime(date_str, '%Y-%m-%d')
        
        transaction = Transaction(
            description=description,
            amount=amount,
            category=category,
            type=type_,
            date=date,
            user_id=current_user.id
        )
        
        db.session.add(transaction)
        db.session.commit()
        
        return redirect(url_for('main.transactions'))
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@main.route('/edit_transaction/<int:id>', methods=['GET', 'POST'])
@login_required
def edit_transaction(id):
    transaction = Transaction.query.get_or_404(id)
    
    # Ensure user owns this transaction
    if transaction.user_id != current_user.id:
        flash('Unauthorized access')
        return redirect(url_for('transactions'))
    
    if request.method == 'POST':
        data = request.get_json()  # Changed to handle JSON data
        transaction.description = data.get('description')
        transaction.amount = float(data.get('amount'))
        transaction.category = data.get('category')
        transaction.type = data.get('type')
        transaction.date = datetime.strptime(data.get('date'), '%Y-%m-%d')
        
        db.session.commit()
        return jsonify({'message': 'Transaction updated successfully'})
    
    return jsonify({
        'id': transaction.id,
        'description': transaction.description,
        'amount': transaction.amount,
        'category': transaction.category,
        'type': transaction.type,
        'date': transaction.date.strftime('%Y-%m-%d')
    })

@main.route('/delete_transaction/<int:id>', methods=['POST'])
@login_required
def delete_transaction(id):
    try:
        transaction = Transaction.query.filter_by(id=id, user_id=current_user.id).first()
        if not transaction:
            return jsonify({'error': 'Transaction not found'}), 404
        
        db.session.delete(transaction)
        db.session.commit()
        return jsonify({'message': 'Transaction deleted successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 400

@main.route('/api/summary')
@login_required
def get_summary():
    income = db.session.query(func.sum(Transaction.amount))\
        .filter_by(user_id=current_user.id, type='income').scalar() or 0
    expenses = db.session.query(func.sum(Transaction.amount))\
        .filter_by(user_id=current_user.id, type='expense').scalar() or 0
    
    return jsonify({
        'income': float(income),
        'expenses': float(expenses),
        'balance': float(income - expenses)
    })
