# Παράδειγμα: 6. Ουρά - εξυπηρέτηση πελατών (κεφ. 8.4)

def enqueue(queue, item):
    queue.append(item)

def dequeue(queue):
    return queue.pop(0)

def isEmpty(queue):
    return len(queue) == 0


oura = []
for pelatis in ['Μαρία', 'Κώστας', 'Δήμητρα']:
    enqueue(oura, pelatis)
    print "Ήρθε:", pelatis, "  Ουρά:", len(oura), "άτομα"

print
while not isEmpty(oura):
    print "Εξυπηρετείται:", dequeue(oura)
print "Η ουρά άδειασε."
