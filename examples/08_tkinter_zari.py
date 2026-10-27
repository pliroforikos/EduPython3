# -*- coding: utf-8 -*-
# Παράδειγμα: 8. Tkinter - ζάρι (κεφ. 9.3)
from Tkinter import *
from random import randint

window = Tk()
window.title("Ζάρι")
text = Text(window, width=2, height=1, font=("Arial", 28))
text.pack(padx=20, pady=10)

lektika = {1: 'ένα βήμα', 2: 'δύο βήματα', 3: 'τρία βήματα',
           4: 'τέσσερα βήματα', 5: 'πέντε βήματα', 6: 'έξι βήματα'}
minima = Label(window, text='')
minima.pack()

def roll():
    text.delete(0.0, END)
    a = randint(1, 6)
    text.insert(END, str(a))
    minima.config(text='Προχώρα ' + lektika[a] + ' το πιόνι')

buttonA = Button(window, text='Πάτα για να παίξεις!', command=roll)
buttonA.pack(padx=20, pady=10)

window.mainloop()
