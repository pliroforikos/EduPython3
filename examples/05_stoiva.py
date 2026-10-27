# Παράδειγμα: 5. Στοίβα - αντιστροφή αριθμών (κεφ. 8.3)

def push(stack, item):
    stack.append(item)

def pop(stack):
    return stack.pop()

def isEmpty(stack):
    return len(stack) == 0

def createStack():
    return []


stack = createStack()
print("Δώσε αριθμούς (0 για τέλος):")
number = int(input())
while number != 0:
    push(stack, number)
    number = int(input())

print("Οι αριθμοί με αντίστροφη σειρά:")
while not isEmpty(stack):
    number = pop(stack)
    print(number)
